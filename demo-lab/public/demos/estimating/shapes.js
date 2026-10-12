/* Shape weight table, lb/ft. Values from the AISC Steel Construction Manual
   shapes database (v16). W, S, M, HP, C, MC and WT carry their nominal weight
   in the name, so those are read from the designation. HSS, angles and pipe
   are looked up here. Plate is figured at 490 lb/cu ft. If a shape is not in
   here it gets flagged, never guessed. Same rule as the shop estimating app. */
(function (root) {
  var T = {
    // Square and rectangular HSS (lb/ft)
    "HSS2X2X1/8": 3.05, "HSS2X2X3/16": 4.32, "HSS2X2X1/4": 5.41,
    "HSS3X3X1/8": 4.75, "HSS3X3X3/16": 6.87, "HSS3X3X1/4": 8.81, "HSS3X3X5/16": 10.58, "HSS3X3X3/8": 12.11,
    "HSS4X4X1/8": 6.46, "HSS4X4X3/16": 9.42, "HSS4X4X1/4": 12.21, "HSS4X4X5/16": 14.83, "HSS4X4X3/8": 17.27, "HSS4X4X1/2": 21.63,
    "HSS5X5X3/16": 11.97, "HSS5X5X1/4": 15.62, "HSS5X5X5/16": 19.08, "HSS5X5X3/8": 22.37, "HSS5X5X1/2": 28.43,
    "HSS6X6X3/16": 14.53, "HSS6X6X1/4": 19.02, "HSS6X6X5/16": 23.34, "HSS6X6X3/8": 27.48, "HSS6X6X1/2": 35.24,
    "HSS8X8X1/4": 25.82, "HSS8X8X5/16": 31.84, "HSS8X8X3/8": 37.69, "HSS8X8X1/2": 48.85,
    "HSS4X2X1/4": 8.81, "HSS6X4X1/4": 15.62, "HSS6X4X3/8": 22.37, "HSS6X3X1/4": 14.17,
    "HSS8X4X1/4": 19.02, "HSS8X4X3/8": 27.48, "HSS8X6X1/4": 22.42, "HSS8X6X3/8": 32.58,
    // Angles (lb/ft)
    "L2X2X1/8": 1.65, "L2X2X3/16": 2.44, "L2X2X1/4": 3.19,
    "L2-1/2X2-1/2X1/4": 4.1, "L2-1/2X2-1/2X3/8": 5.9,
    "L3X3X1/4": 4.9, "L3X3X5/16": 6.1, "L3X3X3/8": 7.2, "L3X3X1/2": 9.4,
    "L3-1/2X3-1/2X1/4": 5.8, "L3-1/2X3-1/2X3/8": 8.5,
    "L4X4X1/4": 6.6, "L4X4X5/16": 8.2, "L4X4X3/8": 9.8, "L4X4X1/2": 12.8,
    "L5X5X5/16": 10.3, "L5X5X3/8": 12.3, "L5X5X1/2": 16.2,
    "L6X6X3/8": 14.9, "L6X6X1/2": 19.6, "L6X6X5/8": 24.2, "L6X6X3/4": 28.7,
    "L3X2X1/4": 4.1, "L3X2-1/2X1/4": 4.5, "L4X3X1/4": 5.8, "L4X3X3/8": 8.5,
    "L5X3X3/8": 9.8, "L5X3-1/2X3/8": 10.4, "L6X4X3/8": 12.3, "L6X4X1/2": 16.2,
    // Pipe (lb/ft)
    "PIPE1-1/2STD": 2.72, "PIPE2STD": 3.65, "PIPE2-1/2STD": 5.79, "PIPE3STD": 7.58,
    "PIPE4STD": 10.79, "PIPE5STD": 14.62, "PIPE6STD": 18.97,
    "PIPE2XS": 5.02, "PIPE3XS": 10.25, "PIPE4XS": 14.98
  };
  var DEC = { "125": "1/8", "1875": "3/16", "25": "1/4", "3125": "5/16", "375": "3/8", "5": "1/2", "625": "5/8", "75": "3/4" };

  function normalize(text) {
    if (typeof text !== "string") return "";
    var s = text.trim().replace(/\s+/g, "").toUpperCase().replace(/[×*]/g, "X");
    s = s.replace(/^PIPE/, "PIPE").replace(/STANDARD$/, "STD");
    // 0.250 or .25 wall to fraction
    s = s.replace(/X0?\.(\d+)$/, function (m, d) { d = d.replace(/0+$/, ""); return DEC[d] ? "X" + DEC[d] : m; });
    return s;
  }

  function frac(str) {
    // "1/2", "3", "2-1/2", "0.5"
    var m = /^(\d+)-(\d+)\/(\d+)$/.exec(str); if (m) return +m[1] + m[2] / m[3];
    m = /^(\d+)\/(\d+)$/.exec(str); if (m) return m[1] / m[2];
    if (/^\d*\.?\d+$/.test(str)) return parseFloat(str);
    return NaN;
  }

  // Returns {plf, family, how} or null. Never invents a weight.
  function lookup(designation) {
    var s = normalize(designation);
    if (!s) return null;
    if (T[s] != null) return { shape: s, plf: T[s], family: (/^(HSS|PIPE|L)/.exec(s) || [""])[0], how: "table" };
    var m = /^(W|S|M|HP|C|MC|WT|ST|MT)(\d+(?:\.\d+)?)X(\d+(?:\.\d+)?)$/.exec(s);
    if (m) return { shape: s, plf: parseFloat(m[3]), family: m[1], how: "nominal" };
    m = /^PL([\d\/.-]+)(?:"|IN)?X([\d\/.-]+)(?:"|IN)?$/.exec(s);
    if (m) {
      var t = frac(m[1]), w = frac(m[2]);
      if (t > 0 && w > 0) {
        if (t > w) { var x = t; t = w; w = x; }
        return { shape: s, plf: Math.round(t * w / 144 * 490 * 100) / 100, family: "PL", how: "plate 490 pcf" };
      }
    }
    return null;
  }

  var api = { TABLE: T, normalize: normalize, lookup: lookup };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.GMAShapes = api;
})(this);
