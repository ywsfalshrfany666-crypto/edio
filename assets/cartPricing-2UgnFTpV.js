function e(r,t){return!t||t.minSubtotal&&r<t.minSubtotal?0:t.type==="percent"?Math.round(r*t.value/100):Math.min(t.value,r)}function a(r,t){return Math.max(0,r-e(r,t))}export{a,e as g};
