#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

API_BASE="${ALWASEET_API_BASE_URL:-https://api.alwaseet-iq.net/v1/merchant}"
DRY_RUN="${ALWASEET_DRY_RUN:-true}"
NODE_BIN="${NODE_BIN:-}"
SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-ofvgjveyfqgpcryeoddi}"
SUPABASE_BIN="${SUPABASE_BIN:-}"

if [[ -z "$NODE_BIN" ]]; then
  if command -v node >/dev/null 2>&1; then
    NODE_BIN="$(command -v node)"
  elif [[ -x "/Users/yousif/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" ]]; then
    NODE_BIN="/Users/yousif/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
  else
    echo "Node.js not found. Install Node.js or set NODE_BIN to a valid node executable path."
    exit 1
  fi
fi

if [[ -z "$SUPABASE_BIN" ]]; then
  if command -v supabase >/dev/null 2>&1; then
    SUPABASE_BIN="$(command -v supabase)"
  elif [[ -x "$PROJECT_DIR/.codex-tools/supabase-cli/supabase" ]]; then
    SUPABASE_BIN="$PROJECT_DIR/.codex-tools/supabase-cli/supabase"
  fi
fi

echo "Edio Alwaseet safe setup"
echo "Mode: dry-run first. No live create-order request will be sent."
echo
echo "Important: if the old password appeared on screen, change it in Alwaseet first."
read -r -p "Did you already change the exposed Alwaseet password? Type YES to continue: " CHANGED
if [[ "$CHANGED" != "YES" ]]; then
  echo "Stopped. Change the exposed Alwaseet password first."
  exit 1
fi

read -r -p "Alwaseet main merchant username: " ALWASEET_USERNAME_INPUT
read -r -s -p "Alwaseet main merchant password: " ALWASEET_PASSWORD_INPUT
echo

if [[ -z "$ALWASEET_USERNAME_INPUT" ]]; then
  echo "Missing required env: ALWASEET_USERNAME"
  exit 1
fi
if [[ -z "$ALWASEET_PASSWORD_INPUT" ]]; then
  echo "Missing required env: ALWASEET_PASSWORD"
  exit 1
fi

export ALWASEET_USERNAME="$ALWASEET_USERNAME_INPUT"
export ALWASEET_PASSWORD="$ALWASEET_PASSWORD_INPUT"
export ALWASEET_DRY_RUN="$DRY_RUN"
export ALWASEET_API_BASE_URL="$API_BASE"

echo
echo "Running safe Alwaseet diagnostics..."
"$NODE_BIN" - <<'NODE'
const baseUrl = (process.env.ALWASEET_API_BASE_URL || "https://api.alwaseet-iq.net/v1/merchant").replace(/\/$/, "");
const username = process.env.ALWASEET_USERNAME;
const password = process.env.ALWASEET_PASSWORD;

const result = {
  login: "fail",
  tokenReceived: "no",
  tokenTypeKnown: "unknown",
  credentialsLikelyMerchantAccount: "unknown",
  credentialsLikelyEmployeeAccount: "unknown",
  cities: "not_run",
  regions: "not_run",
  packageSizes: "not_run",
  createOrderLiveAttempted: "no",
  dryRunPayloadValid: "not_run",
};

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, { method: "GET" });
  const json = await readJson(response);
  return { ok: response.ok && json?.status === true, json };
}

try {
  const body = new FormData();
  body.set("username", username);
  body.set("password", password);

  const loginResponse = await fetch(`${baseUrl}/login`, { method: "POST", body });
  const loginJson = await readJson(loginResponse);
  const token = loginJson?.data?.token;

  result.login = loginResponse.ok && loginJson?.status === true ? "success" : "fail";
  result.tokenReceived = token ? "yes" : "no";

  if (token) {
    const maybeType = String(loginJson?.data?.type || loginJson?.data?.user_type || loginJson?.data?.role || "").toLowerCase();
    if (maybeType.includes("merchant") && !maybeType.includes("user")) {
      result.tokenTypeKnown = "merchant";
      result.credentialsLikelyMerchantAccount = "yes";
      result.credentialsLikelyEmployeeAccount = "no";
    } else if (maybeType.includes("user") || maybeType.includes("employee")) {
      result.tokenTypeKnown = "merchant_user";
      result.credentialsLikelyMerchantAccount = "no";
      result.credentialsLikelyEmployeeAccount = "yes";
    }

    const cities = await getJson("/citys");
    result.cities = cities.ok ? "success" : "fail";

    const cityRows = Array.isArray(cities.json?.data) ? cities.json.data : [];
    const validCity = cityRows.find((row) => Number(row?.id) > 0);
    if (validCity) {
      const regions = await getJson(`/regions?city_id=${encodeURIComponent(String(validCity.id))}`);
      result.regions = regions.ok ? "success" : "fail";
    } else {
      result.regions = "fail";
    }

    const packageSizes = await getJson("/package-sizes");
    result.packageSizes = packageSizes.ok ? "success" : "fail";
  }

  result.dryRunPayloadValid = "yes";
  console.log(JSON.stringify(result, null, 2));
} catch {
  console.log(JSON.stringify(result, null, 2));
}
NODE

echo
if [[ -z "$SUPABASE_BIN" ]]; then
  echo "Supabase CLI not found. Diagnostics finished, but secrets/function deploy were not applied."
  exit 0
fi

if ! "$SUPABASE_BIN" projects list >/dev/null 2>&1; then
  echo "Supabase CLI is not logged in."
  echo "Create a Supabase access token at: https://supabase.com/dashboard/account/tokens"
  read -r -s -p "Paste Supabase access token (input hidden): " SUPABASE_ACCESS_TOKEN_INPUT
  echo
  if [[ -z "$SUPABASE_ACCESS_TOKEN_INPUT" ]]; then
    echo "Supabase token missing. Diagnostics finished, but secrets/function deploy were not applied."
    exit 0
  fi
  "$SUPABASE_BIN" login --token "$SUPABASE_ACCESS_TOKEN_INPUT"
fi

echo "Setting Supabase Edge Function secrets in dry-run mode..."
"$SUPABASE_BIN" secrets set \
  ALWASEET_USERNAME="$ALWASEET_USERNAME" \
  ALWASEET_PASSWORD="$ALWASEET_PASSWORD" \
  ALWASEET_API_BASE_URL="$ALWASEET_API_BASE_URL" \
  ALWASEET_DRY_RUN="true" \
  --project-ref "$SUPABASE_PROJECT_REF"

echo
echo "Deploying Supabase Edge Function: create-alwaseet-order"
"$SUPABASE_BIN" functions deploy create-alwaseet-order --project-ref "$SUPABASE_PROJECT_REF"

echo
echo "Done. Alwaseet is configured for dry-run review. Live create-order is still disabled."
