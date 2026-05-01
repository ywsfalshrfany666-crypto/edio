import type { TFunction } from "i18next";

export type NavChild = { label: string; to: string };
export type NavGroup = { label: string; to?: string; children?: NavChild[] };
export type NavItem = { label: string; to: string; groups?: NavGroup[] };

export const buildNav = (t: TFunction): NavItem[] => [
  {
    label: t("nav.headphones"),
    to: "/category/headphones",
    groups: [
      {
        label: t("navMenus.headphones.typeBack.title"),
        to: "/category/headphones/type-back",
        children: [
          { label: t("navMenus.headphones.typeBack.closed"), to: "/category/headphones/closed-back" },
          { label: t("navMenus.headphones.typeBack.open"), to: "/category/headphones/open-back" },
        ],
      },
      {
        label: t("navMenus.headphones.driver.title"),
        to: "/category/headphones/driver-configuration",
        children: [
          { label: t("navMenus.headphones.driver.dynamic"), to: "/category/headphones/dynamic-driver" },
          { label: t("navMenus.headphones.driver.planar"), to: "/category/headphones/planar-driver" },
        ],
      },
    ],
  },
  {
    label: t("nav.iems"),
    to: "/category/iems",
    groups: [
      {
        label: t("navMenus.iems.driver.title"),
        to: "/category/iems/driver-configuration",
        children: [
          { label: t("navMenus.iems.driver.dynamic"), to: "/category/iems/dynamic-driver" },
          { label: t("navMenus.iems.driver.planar"), to: "/category/iems/planar-driver" },
          { label: t("navMenus.iems.driver.balancedArmatures"), to: "/category/iems/balanced-armatures" },
          { label: t("navMenus.iems.driver.hybrid"), to: "/category/iems/hybrid-drivers" },
        ],
      },
      { label: t("navMenus.iems.wireless"), to: "/category/iems/wireless" },
    ],
  },
  { label: t("nav.dap"), to: "/category/dap" },
  {
    label: t("nav.dacAmp"),
    to: "/category/dac",
    groups: [
      { label: t("navMenus.dacAmp.portable"), to: "/category/dac/portable" },
      { label: t("navMenus.dacAmp.desktop"), to: "/category/dac/desktop" },
      { label: t("navMenus.dacAmp.bluetooth"), to: "/category/dac/bluetooth" },
    ],
  },
  {
    label: t("nav.mic"),
    to: "/category/mic",
    groups: [
      { label: t("navMenus.mic.dynamic"), to: "/category/mic/dynamic" },
      { label: t("navMenus.mic.condenser"), to: "/category/mic/condenser" },
    ],
  },
  { label: t("nav.audioInterface"), to: "/category/audio-interface" },
  {
    label: t("nav.accessories"),
    to: "/category/accessories",
    groups: [
      { label: t("navMenus.accessories.cables"), to: "/category/accessories/audio-cables" },
      { label: t("navMenus.accessories.eartips"), to: "/category/accessories/eartips" },
      { label: t("navMenus.accessories.convertors"), to: "/category/accessories/cable-convertors" },
      { label: t("navMenus.accessories.cases"), to: "/category/accessories/cases" },
    ],
  },
  { label: t("nav.preowned"), to: "/shop?filter=preowned" },
];
