(function () {
  "use strict";

  /**
   * Milford GeoJSON field names (schoollocations, student hex layer, isochrones).
   */
  var FIELD_MAP = {
    schoolId: "OBJECTID",
    schoolName: "School",
    schoolLevel: "Level",
    /** Synthetic: ELEMENTARY | MIDDLE | HIGH set when loading schoollocations */
    schoolType: "_dash_level",
    /** Primary hex field for assigned school name (see hexAssignedSchoolNameFromProps). */
    hexSchoolName: "School",
    hexGrade: "grade_level",
    hexId: "GRID_ID",
    isoName: "Name",
    isoToBreak: "ToBreak",
  };

  /** Paths must match deployed filenames exactly (GitHub Pages is case-sensitive). */
  var DATA = {
    schools: "SchoolLocations.geojson",
    studentHexes: "NewStudentHexagons.geojson",
    schoolIsochrones: "Isochrones.geojson",
  };

  /** Network distance isochrones: ToBreak is meters; rings every 0.5 mi up to 5 mi. */
  var ISO_STEP_MI = 0.5;
  var METERS_PER_MILE = 1609.344;
  var MAX_ISO_RING = 10;
  var MAX_TRAVEL_MI = 5;
  var SQ_METERS_PER_SQ_MI = 2589988.110336;

  /**
   * Maps alternate spellings (lower case key) → canonical School string from schoollocations.geojson.
   * Extend when exports disagree between hex / iso / school points.
   */
  var SCHOOL_ALIAS_TO_CANONICAL = {
    "john f kennedy elementary school": "J. F. Kennedy Elementary School",
    "joseph a foran high school": "Joseph A. Foran High School",
    "jonathan law high school": "Jonathan Law High School",
  };

  /** Built after schools load: exact School → OBJECTID */
  var NAME_TO_OBJECTID = Object.create(null);
  /** Lower-case trimmed School → exact School string */
  var LOWER_NAME_TO_CANONICAL = Object.create(null);

  var MAPBOX_ACCESS_TOKEN =
    "pk.eyJ1IjoicGF0d2QwNSIsImEiOiJjbTZ2bGVhajIwMTlvMnFwc2owa3BxZHRoIn0.moDNfqMUolnHphdwsIF87w";
  var MAPBOX_STYLES = {
    light: "mapbox://styles/mapbox/light-v11",
    streets: "mapbox://styles/mapbox/streets-v12",
    satellite: "mapbox://styles/mapbox/satellite-v9",
  };

  var PALETTE = {
    elementary: { fill: "#16a34a", line: "#15803d", highlightStroke: "#4ade80" },
    middle: { fill: "#2563eb", line: "#1d4ed8", highlightStroke: "#93c5fd" },
    high: { fill: "#9333ea", line: "#7e22ce", highlightStroke: "#d8b4fe" },
    jrSr: { fill: "#ea580c", line: "#c2410c", highlightStroke: "#fb923c" },
  };

  /** Shown on map and in travel shed data; omitted from #school-select by design */
  var PLATT_TECHNICAL_SCHOOL_NAME = "Platt Technical High School";

  var HEAT_SCHOOL_DENSITY = [
    "^",
    ["max", 0, ["min", 1, ["heatmap-density"]]],
    0.42,
  ];
  var HEAT_STUDENT_RAMP_SCHOOL = [
    "interpolate",
    ["linear"],
    HEAT_SCHOOL_DENSITY,
    0,
    "rgba(34, 211, 238, 0)",
    0.018,
    "rgba(34, 211, 238, 0.088)",
    0.045,
    "rgba(20, 198, 225, 0.229)",
    0.08,
    "rgba(8, 172, 198, 0.334)",
    0.12,
    "rgba(6, 155, 182, 0.422)",
    0.16,
    "rgba(6, 182, 212, 0.484)",
    0.2,
    "rgba(56, 189, 248, 0.528)",
    0.213,
    "rgba(70, 150, 244, 0.525)",
    0.225,
    "rgba(85, 120, 238, 0.533)",
    0.238,
    "rgba(98, 88, 230, 0.473)",
    0.25,
    "rgba(105, 58, 220, 0.476)",
    0.26,
    "rgba(109, 40, 217, 0.48)",
    0.29,
    "rgba(128, 46, 225, 0.495)",
    0.32,
    "rgba(147, 51, 234, 0.51)",
    0.35,
    "rgba(158, 68, 240, 0.525)",
    0.38,
    "rgba(168, 85, 247, 0.54)",
    0.41,
    "rgba(180, 62, 230, 0.555)",
    0.44,
    "rgba(192, 38, 211, 0.57)",
    0.47,
    "rgba(205, 38, 180, 0.585)",
    0.485,
    "rgba(212, 38, 150, 0.593)",
    0.5,
    "rgba(219, 39, 119, 0.8)",
    0.56,
    "rgba(225, 29, 72, 0.83)",
    0.62,
    "rgba(220, 38, 38, 0.86)",
    0.68,
    "rgba(234, 88, 12, 0.88)",
    0.74,
    "rgba(245, 101, 20, 0.9)",
    0.8,
    "rgba(251, 146, 60, 0.92)",
    0.86,
    "rgba(253, 186, 55, 0.94)",
    0.91,
    "rgba(253, 224, 71, 0.96)",
    0.95,
    "rgba(254, 240, 138, 0.98)",
    0.98,
    "rgba(255, 251, 200, 0.99)",
    1,
    "rgba(255, 255, 230, 1)",
  ];
  var HEAT_STUDENT_RAMP_UNIFORM = [
    "interpolate",
    ["linear"],
    ["heatmap-density"],
    0,
    "rgba(34, 211, 238, 0)",
    0.164,
    "rgba(34, 211, 238, 0.088)",
    0.2477,
    "rgba(20, 198, 225, 0.229)",
    0.3209,
    "rgba(8, 172, 198, 0.334)",
    0.3852,
    "rgba(6, 155, 182, 0.422)",
    0.4384,
    "rgba(6, 182, 212, 0.484)",
    0.4847,
    "rgba(56, 189, 248, 0.528)",
    0.4986,
    "rgba(70, 150, 244, 0.525)",
    0.5111,
    "rgba(85, 120, 238, 0.533)",
    0.5242,
    "rgba(98, 88, 230, 0.473)",
    0.5359,
    "rgba(105, 58, 220, 0.476)",
    0.5454,
    "rgba(109, 40, 217, 0.48)",
    0.5729,
    "rgba(128, 46, 225, 0.495)",
    0.5988,
    "rgba(147, 51, 234, 0.51)",
    0.6235,
    "rgba(158, 68, 240, 0.525)",
    0.647,
    "rgba(168, 85, 247, 0.54)",
    0.6695,
    "rgba(180, 62, 230, 0.555)",
    0.6911,
    "rgba(192, 38, 211, 0.57)",
    0.7119,
    "rgba(205, 38, 180, 0.585)",
    0.7221,
    "rgba(212, 38, 150, 0.593)",
    0.732,
    "rgba(219, 39, 119, 0.8)",
    0.7703,
    "rgba(225, 29, 72, 0.83)",
    0.8064,
    "rgba(220, 38, 38, 0.86)",
    0.8407,
    "rgba(234, 88, 12, 0.88)",
    0.8733,
    "rgba(245, 101, 20, 0.9)",
    0.9045,
    "rgba(251, 146, 60, 0.92)",
    0.9344,
    "rgba(253, 186, 55, 0.94)",
    0.9584,
    "rgba(253, 224, 71, 0.96)",
    0.9772,
    "rgba(254, 240, 138, 0.98)",
    0.9909,
    "rgba(255, 251, 200, 0.99)",
    1,
    "rgba(255, 255, 230, 1)",
  ];

  var HEAT_RESIDENCE_INTENSITY = [
    "interpolate",
    ["linear"],
    ["zoom"],
    8,
    0.05,
    10,
    0.07,
    12,
    0.1,
    14,
    0.16,
    16,
    0.24,
    17,
    0.3,
  ];

  var GEO = {
    schools: null,
    studentHex: null,
    isochronesRaw: null,
  };
  var STUDENT_HEX_INDEX = null;
  var SCHOOL_ISO_ENRICHED = null;
  /** hexKey → grade key (numeric string) → count for students attending each school */
  var GRADE_COUNTS_BY_SCHOOL_HEX = null;
  /** Last GeoJSON passed to the isochrone source (for point-in-polygon hover tooltips). */
  var LAST_ISOCHRONE_DISPLAY_FC = null;
  /** Matches GeoJSON `promoteId` on school-isochrones for hover outline. */
  var hoveredIsochroneUid = null;
  var selectedSchoolMsid = null;
  /** Slider half-mile steps 1–10 → 0.5–5 mi */
  var travelShedMaxHalfSteps = 10;
  var mapLayersInitialized = false;
  var map;
  /** Points in student-hex source when density is enabled (for zoom gating). */
  var studentHexLayerFeatureCount = 0;
  /**
   * Hide residential density when zoomed in past this level (visible at z ≤ value).
   */
  var STUDENT_RESIDENCE_DENSITY_MAX_ZOOM = 14.25;

  function prop(obj, key) {
    if (!obj || key == null) return null;
    return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : null;
  }

  function normalizeWhitespace(s) {
    return String(s || "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function rebuildSchoolNameIndexes(schoolsFc) {
    NAME_TO_OBJECTID = Object.create(null);
    LOWER_NAME_TO_CANONICAL = Object.create(null);
    if (!schoolsFc || !schoolsFc.features) return;
    var nameKey = FIELD_MAP.schoolName;
    var idKey = FIELD_MAP.schoolId;
    for (var i = 0; i < schoolsFc.features.length; i++) {
      var p = schoolsFc.features[i].properties || {};
      var nm = prop(p, nameKey);
      var oid = prop(p, idKey);
      if (nm == null || nm === "" || oid == null) continue;
      nm = normalizeWhitespace(nm);
      NAME_TO_OBJECTID[nm] = Number(oid);
      LOWER_NAME_TO_CANONICAL[nm.toLowerCase()] = nm;
    }
  }

  function resolveCanonicalSchoolName(raw) {
    var n = normalizeWhitespace(raw);
    if (!n) return null;
    var low = n.toLowerCase();
    if (SCHOOL_ALIAS_TO_CANONICAL[low]) return SCHOOL_ALIAS_TO_CANONICAL[low];
    if (LOWER_NAME_TO_CANONICAL[low]) return LOWER_NAME_TO_CANONICAL[low];
    return null;
  }

  function resolveSchoolObjectId(rawName) {
    var canon = resolveCanonicalSchoolName(rawName);
    if (!canon) return null;
    var id = NAME_TO_OBJECTID[canon];
    return id != null && !isNaN(Number(id)) ? Number(id) : null;
  }

  function dashLevelFromSchoolLevel(levelStr) {
    var L = normalizeWhitespace(levelStr);
    if (!L) return "ELEMENTARY";
    if (/^high\s*\/\s*technical$/i.test(L)) return "TECHNICAL";
    if (/elementary/i.test(L)) return "ELEMENTARY";
    if (/middle/i.test(L)) return "MIDDLE";
    if (/high/i.test(L)) return "HIGH";
    return "ELEMENTARY";
  }

  function enrichSchoolLocations(fc) {
    if (!fc || !fc.features) return fc;
    var out = [];
    var levelKey = FIELD_MAP.schoolLevel;
    for (var i = 0; i < fc.features.length; i++) {
      var f = fc.features[i];
      var p = Object.assign({}, f.properties || {});
      p[FIELD_MAP.schoolType] = dashLevelFromSchoolLevel(prop(p, levelKey));
      out.push({ type: "Feature", geometry: f.geometry, properties: p });
    }
    return { type: "FeatureCollection", features: out };
  }

  /** Schools shown on the map (excludes technical school shown only in backend data). */
  function schoolsFeatureCollectionForMap(fc) {
    if (!fc || !fc.features) return fc;
    var nameKey = FIELD_MAP.schoolName;
    var out = [];
    for (var i = 0; i < fc.features.length; i++) {
      var f = fc.features[i];
      var nm = prop(f.properties || {}, nameKey);
      if (nm === PLATT_TECHNICAL_SCHOOL_NAME) continue;
      out.push(f);
    }
    return { type: "FeatureCollection", features: out };
  }

  /** NewStudentHexagons uses `School`; legacy StudentHexagons used `School_Name`. */
  function hexAssignedSchoolNameFromProps(p) {
    if (!p) return null;
    var primary = prop(p, FIELD_MAP.hexSchoolName);
    if (primary != null && String(primary).trim() !== "") return primary;
    return prop(p, "School_Name");
  }

  function stripIsochroneNamePrefix(rawName) {
    if (rawName == null || rawName === "") return "";
    var s = String(rawName).trim();
    var idx = s.indexOf(" : ");
    if (idx >= 0) s = s.slice(0, idx).trim();
    return s;
  }

  function hexCountsBySchoolFromHex(hexFc) {
    var out = Object.create(null);
    if (!hexFc || !hexFc.features) return out;
    for (var i = 0; i < hexFc.features.length; i++) {
      var p = hexFc.features[i].properties || {};
      var oid = resolveSchoolObjectId(hexAssignedSchoolNameFromProps(p));
      if (oid == null) continue;
      var sk = String(oid);
      out[sk] = (out[sk] || 0) + 1;
    }
    return out;
  }

  function isoCountsBySchoolFromRaw(rawFc) {
    var out = Object.create(null);
    if (!rawFc || !rawFc.features) return out;
    var nk = FIELD_MAP.isoName;
    for (var i = 0; i < rawFc.features.length; i++) {
      var p = rawFc.features[i].properties || {};
      var nm = stripIsochroneNamePrefix(prop(p, nk));
      var oid = resolveSchoolObjectId(nm);
      if (oid == null) continue;
      var sk = String(oid);
      out[sk] = (out[sk] || 0) + 1;
    }
    return out;
  }

  var GRADE_ORDER = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  function gradeAxisLabel(g) {
    var n = Number(g);
    if (n === -1) return "PK";
    if (n === 0) return "K";
    return String(n);
  }

  /** Phrase for proximity tooltips, e.g. "6th Graders" or "kindergarteners". */
  function gradeGroupNounPhraseForTooltip(g) {
    var n = Number(g);
    if (n === -1) return "Pre-K students";
    if (n === 0) return "kindergarteners";
    var s = n % 100;
    var suf = "th";
    if (s < 11 || s > 13) {
      switch (n % 10) {
        case 1:
          suf = "st";
          break;
        case 2:
          suf = "nd";
          break;
        case 3:
          suf = "rd";
          break;
        default:
          suf = "th";
      }
    }
    return String(n) + suf + " Graders";
  }

  function aggregateEnrollmentByGrade(hexFc, schoolObjectIdOrNull) {
    var counts = Object.create(null);
    if (!hexFc || !hexFc.features) return counts;
    var gradeField = FIELD_MAP.hexGrade;
    for (var i = 0; i < hexFc.features.length; i++) {
      var p = hexFc.features[i].properties || {};
      var oid = resolveSchoolObjectId(hexAssignedSchoolNameFromProps(p));
      if (oid == null) continue;
      if (schoolObjectIdOrNull != null && oid !== schoolObjectIdOrNull) continue;
      var gl = prop(p, gradeField);
      if (gl === null || gl === undefined || gl === "") continue;
      var gk = Number(gl);
      if (isNaN(gk)) continue;
      var key = String(gk);
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }

  function sumEnrollmentCounts(countsByGrade) {
    var t = 0;
    for (var k in countsByGrade) {
      if (!Object.prototype.hasOwnProperty.call(countsByGrade, k)) continue;
      t += Number(countsByGrade[k]) || 0;
    }
    return t;
  }

  /** True if #school-select lists this OBJECTID (excludes schools omitted from the dropdown). */
  function schoolSelectHasOptionForObjectId(sel, objectId) {
    if (!sel || objectId == null || isNaN(objectId)) return false;
    var want = String(Number(objectId));
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === want) return true;
    }
    return false;
  }

  /** Always renders one column per grade in GRADE_ORDER so bar spacing stays fixed. */
  function renderEnrollmentChart(hostEl, countsByGrade) {
    if (!hostEl) return;
    var total = 0;
    var maxC = 0;
    var gi;
    for (gi = 0; gi < GRADE_ORDER.length; gi++) {
      var g0 = GRADE_ORDER[gi];
      var c0 = Number(countsByGrade[String(g0)] || 0);
      total += c0;
      if (c0 > maxC) maxC = c0;
    }
    if (total === 0) {
      hostEl.innerHTML =
        '<p class="enrollment-chart-panel__empty">No grade-level records for this selection.</p>';
      return;
    }
    var htm =
      '<div class="enrollment-chart" role="img" aria-label="Enrollment by grade">';
    for (gi = 0; gi < GRADE_ORDER.length; gi++) {
      var g = GRADE_ORDER[gi];
      var c = Number(countsByGrade[String(g)] || 0);
      var pct = maxC > 0 ? Math.round((c / maxC) * 100) : 0;
      var barCls =
        c > 0 ? "enrollment-chart__bar" : "enrollment-chart__bar enrollment-chart__bar--zero";
      htm +=
        '<div class="enrollment-chart__col">' +
        '<div class="enrollment-chart__bar-stack">' +
        '<div class="enrollment-chart__bar-stack-spacer" aria-hidden="true"></div>' +
        '<div class="enrollment-chart__value">' +
        c.toLocaleString() +
        "</div>" +
        '<div class="' +
        barCls +
        '" style="height:' +
        pct +
        '%"></div></div>' +
        '<div class="enrollment-chart__label">' +
        escapeHtml(gradeAxisLabel(g)) +
        "</div>" +
        "</div>";
    }
    htm += "</div>";
    hostEl.innerHTML = htm;
  }

  function syncEnrollmentChart() {
    var host = document.getElementById("enrollment-chart-host");
    var titleEl = document.getElementById("enrollment-chart-panel-title");
    if (!host || !GEO.studentHex) return;
    var sel = document.getElementById("school-select");
    var raw = sel && sel.value !== "" && sel.value != null ? Number(sel.value) : null;
    var scopeLabel;
    var oidFilter = null;
    if (raw != null && !isNaN(raw)) {
      oidFilter = raw;
      var name = schoolDisplayNameByObjectId(raw);
      scopeLabel = name ? name : "Selected school";
    } else {
      scopeLabel = "All schools (summary)";
    }
    if (titleEl) {
      titleEl.innerHTML =
        '<span class="enrollment-chart-panel__title-prefix">Enrollment by grade</span>' +
        '<span class="enrollment-chart-panel__title-suffix">: ' +
        escapeHtml(scopeLabel) +
        "</span>";
    }
    var counts = aggregateEnrollmentByGrade(GEO.studentHex, oidFilter);
    renderEnrollmentChart(host, counts);
  }

  function syncTotalEnrollmentKpi() {
    var el = document.getElementById("kpi-total-enrollment");
    if (!el || !GEO.studentHex) return;
    var sel = document.getElementById("school-select");
    var raw = sel && sel.value !== "" && sel.value != null ? Number(sel.value) : null;
    var oidFilter = raw != null && !isNaN(raw) ? raw : null;
    var counts = aggregateEnrollmentByGrade(GEO.studentHex, oidFilter);
    var total = sumEnrollmentCounts(counts);
    el.textContent = total.toLocaleString();
  }

  function populateProximityReferenceSchoolSelect() {
    var src = document.getElementById("school-select");
    var dst = document.getElementById("proximity-reference-school");
    if (!src || !dst) return;
    dst.innerHTML = '<option value="">Select reference school…</option>';
    var si;
    for (si = 1; si < src.options.length; si++) {
      var o = document.createElement("option");
      o.value = src.options[si].value;
      o.textContent = src.options[si].textContent;
      dst.appendChild(o);
    }
  }

  function updateProximityMaxMilesOutput() {
    var range = document.getElementById("proximity-max-miles");
    var out = document.getElementById("proximity-max-miles-output");
    if (!range) return;
    var v = Number(range.value);
    if (isNaN(v) || v < 1) v = 1;
    if (v > 10) v = 10;
    range.setAttribute("aria-valuenow", String(v));
    if (out) {
      out.textContent = formatTravelMiFromSteps(v);
    }
  }

  function syncProximityMatrix() {
    var host = document.getElementById("proximity-matrix-host");
    if (!host) return;
    if (!GEO.studentHex || !GRADE_COUNTS_BY_SCHOOL_HEX || !SCHOOL_ISO_ENRICHED) {
      host.innerHTML =
        '<p class="enrollment-chart-panel__empty">Loading student geography…</p>';
      return;
    }
    var attendSel = document.getElementById("school-select");
    var refSel = document.getElementById("proximity-reference-school");
    var range = document.getElementById("proximity-max-miles");
    var attendRaw =
      attendSel && attendSel.value !== "" && attendSel.value != null
        ? Number(attendSel.value)
        : NaN;
    var refRaw =
      refSel && refSel.value !== "" && refSel.value != null ? Number(refSel.value) : NaN;
    var maxSteps = range ? Number(range.value) : 10;
    if (isNaN(maxSteps) || maxSteps < 1) maxSteps = 1;
    if (maxSteps > 10) maxSteps = 10;

    if (attendRaw == null || isNaN(attendRaw)) {
      host.innerHTML =
        '<p class="enrollment-chart-panel__empty">Select a school above to set which school students attend.</p>';
      return;
    }
    if (refRaw == null || isNaN(refRaw)) {
      host.innerHTML =
        '<p class="enrollment-chart-panel__empty">Choose a reference school to measure network distance from.</p>';
      return;
    }

    var attendName = schoolDisplayNameByObjectId(attendRaw) || "this school";
    var refName = schoolDisplayNameByObjectId(refRaw) || "the reference school";
    var enrollByGrade = aggregateEnrollmentByGrade(GEO.studentHex, attendRaw);
    var totalEnrollAtSchool = sumEnrollmentCounts(enrollByGrade);

    var colData = [];
    var st;
    for (st = 1; st <= maxSteps; st++) {
      var capMi = st * ISO_STEP_MI;
      var geom = isochroneGeometryForSchoolWithinMaxMi(refRaw, capMi);
      var byGrade = geom
        ? travelShedGradeCountsInIsochrone(geom, attendRaw)
        : null;
      colData.push({
        capMi: capMi,
        byGrade: byGrade && typeof byGrade === "object" ? byGrade : {},
      });
    }

    var gi;
    var rowsHtml = "";
    for (gi = 0; gi < GRADE_ORDER.length; gi++) {
      var g = GRADE_ORDER[gi];
      var gKey = String(g);
      var rowPeak = 0;
      var ci;
      for (ci = 0; ci < colData.length; ci++) {
        var cij = Number(colData[ci].byGrade[gKey] || 0);
        if (cij > rowPeak) rowPeak = cij;
      }
      if (rowPeak === 0) continue;
      var denomG = Number(enrollByGrade[gKey] || 0);
      var gradePhrase = gradeGroupNounPhraseForTooltip(g);
      var cells = "";
      for (ci = 0; ci < colData.length; ci++) {
        var cnt = Number(colData[ci].byGrade[gKey] || 0);
        var capMiCol = colData[ci].capMi;
        var distStr = capMiCol.toFixed(1) + " mi";
        var tip;
        if (denomG > 0) {
          var pctG = Math.round((cnt / denomG) * 100);
          tip =
            pctG +
            "% of " +
            gradePhrase +
            " at " +
            attendName +
            " are within " +
            distStr +
            " of " +
            refName +
            ".";
        } else {
          tip =
            "No students in this grade recorded at " +
            attendName +
            " in the dataset (cell count " +
            cnt.toLocaleString() +
            ").";
        }
        cells +=
          '<td title="' +
          escapeHtml(tip) +
          '">' +
          cnt.toLocaleString() +
          "</td>";
      }
      rowsHtml +=
        "<tr><th scope=\"row\">" +
        escapeHtml(gradeAxisLabel(g)) +
        "</th>" +
        cells +
        "</tr>";
    }

    var totalCells = "";
    var ti;
    for (ti = 0; ti < colData.length; ti++) {
      var colSum = 0;
      for (gi = 0; gi < GRADE_ORDER.length; gi++) {
        colSum += Number(colData[ti].byGrade[String(GRADE_ORDER[gi])] || 0);
      }
      var capMiT = colData[ti].capMi;
      var distStrT = capMiT.toFixed(1) + " mi";
      var tipT;
      if (totalEnrollAtSchool > 0) {
        var pctT = Math.round((colSum / totalEnrollAtSchool) * 100);
        tipT =
          pctT +
          "% of students at " +
          attendName +
          " are within " +
          distStrT +
          " of " +
          refName +
          ".";
      } else {
        tipT =
          "No enrollment records for " +
          attendName +
          " in the dataset (total " +
          colSum.toLocaleString() +
          " in this column).";
      }
      totalCells +=
        '<td title="' +
        escapeHtml(tipT) +
        '">' +
        colSum.toLocaleString() +
        "</td>";
    }

    var headCells = "";
    for (st = 1; st <= maxSteps; st++) {
      var capLbl = "≤" + (st * ISO_STEP_MI).toFixed(1) + " mi";
      headCells += "<th scope=\"col\">" + escapeHtml(capLbl) + "</th>";
    }

    host.innerHTML =
      '<table class="proximity-matrix-table" role="table">' +
      "<caption>" +
      "Percentages use enrollment by grade for the attendance school. " +
      "Columns are cumulative network distance from the reference school.</caption>" +
      "<thead><tr><th scope=\"col\">Grade</th>" +
      headCells +
      "</tr></thead><tbody>" +
      rowsHtml +
      '<tr class="proximity-matrix-table__total-row"><th scope="row">Total</th>' +
      totalCells +
      "</tr></tbody></table>";
  }

  function refreshSchoolSelectionFromSelectValue() {
    var schoolSel = document.getElementById("school-select");
    var raw = schoolSel && schoolSel.value;
    var ms = raw !== "" && raw != null ? Number(raw) : null;
    selectedSchoolMsid = ms != null && !isNaN(ms) ? ms : null;
    clearSchoolSelectionState();
    if (selectedSchoolMsid != null) {
      setSelectedSchoolState(selectedSchoolMsid);
    }
    syncStudentHexLayer();
    syncEnrollmentChart();
    syncTotalEnrollmentKpi();
    syncProximityMatrix();
  }

  /** Match calculator reference dropdown to primary school (dropdown only; map clicks do not call this). */
  function syncProximityReferenceToPrimarySchool() {
    var schoolSel = document.getElementById("school-select");
    var refSel = document.getElementById("proximity-reference-school");
    if (!schoolSel || !refSel) return;
    if (schoolSel.value === "" || schoolSel.value == null) {
      refSel.value = "";
    } else {
      refSel.value = schoolSel.value;
    }
  }

  function trySelectSchoolFromMap(objectId) {
    var sel = document.getElementById("school-select");
    if (!sel || !schoolSelectHasOptionForObjectId(sel, objectId)) return;
    var idStr = String(Number(objectId));
    sel.value = idStr;
    refreshSchoolSelectionFromSelectValue();
  }

  function schoolDisplayNameByObjectId(objectId) {
    if (objectId == null || isNaN(objectId)) return null;
    if (!GEO.schools || !GEO.schools.features) return null;
    var idKey = FIELD_MAP.schoolId;
    var nameKey = FIELD_MAP.schoolName;
    for (var i = 0; i < GEO.schools.features.length; i++) {
      var p = GEO.schools.features[i].properties || {};
      if (Number(prop(p, idKey)) === Number(objectId)) {
        return prop(p, nameKey) != null ? String(prop(p, nameKey)) : null;
      }
    }
    return null;
  }

  function buildGradeCountsBySchoolHex(fc) {
    var out = Object.create(null);
    if (!fc || !fc.features) return out;
    var gf = FIELD_MAP.hexGrade;
    for (var i = 0; i < fc.features.length; i++) {
      var f = fc.features[i];
      var p = f.properties || {};
      var oid = resolveSchoolObjectId(hexAssignedSchoolNameFromProps(p));
      if (oid == null) continue;
      var gl = prop(p, gf);
      if (gl === null || gl === undefined || gl === "") continue;
      var gk = Number(gl);
      if (isNaN(gk)) continue;
      var hk = studentHexKey(f);
      var sk = String(oid);
      var gKey = String(gk);
      if (!out[sk]) out[sk] = Object.create(null);
      if (!out[sk][hk]) out[sk][hk] = Object.create(null);
      out[sk][hk][gKey] = (out[sk][hk][gKey] || 0) + 1;
    }
    return out;
  }

  function gradesServedFromLevel(levelRaw) {
    var L = String(levelRaw || "").trim();
    if (/^high\s*\/\s*technical$/i.test(L)) return "9–12 (Technical)";
    if (/elementary/i.test(L)) return "K–5";
    if (/middle/i.test(L)) return "6–8";
    if (/high/i.test(L)) return "9–12";
    return "—";
  }

  function totalStudentRecordsForSchool(objectId) {
    if (GRADE_COUNTS_BY_SCHOOL_HEX == null || objectId == null || isNaN(objectId)) return null;
    var sh = GRADE_COUNTS_BY_SCHOOL_HEX[String(objectId)];
    if (!sh) return 0;
    var t = 0;
    for (var hk in sh) {
      if (!Object.prototype.hasOwnProperty.call(sh, hk)) continue;
      var gmap = sh[hk];
      for (var g in gmap) {
        if (!Object.prototype.hasOwnProperty.call(gmap, g)) continue;
        t += Number(gmap[g]) || 0;
      }
    }
    return t;
  }

  function schoolHoverHtml(props) {
    var nameKey = FIELD_MAP.schoolName;
    var levelKey = FIELD_MAP.schoolLevel;
    var idKey = FIELD_MAP.schoolId;
    var name = prop(props, nameKey) || "School";
    var lvl = prop(props, levelKey);
    var grades = gradesServedFromLevel(lvl);
    var oid = Number(prop(props, idKey));
    var total = !isNaN(oid) ? totalStudentRecordsForSchool(oid) : null;
    return (
      '<div class="school-hover-inner">' +
      '<strong class="school-hover-name">' +
      escapeHtml(String(name)) +
      "</strong>" +
      '<div class="school-hover-row">Grades served: ' +
      escapeHtml(grades) +
      "</div>" +
      '<div class="school-hover-row">\'25–\'26 enrollment: ' +
      (total != null ? escapeHtml(total.toLocaleString()) : "—") +
      "</div>" +
      '<div class="school-hover-note">Enrollment total reflects student locations attributed to this school in the current dataset.</div>' +
      "</div>"
    );
  }

  function travelShedGradeSortKeyMilford(gradeKeyStr) {
    var n = Number(gradeKeyStr);
    if (isNaN(n)) return 999;
    var ix = GRADE_ORDER.indexOf(n);
    return ix >= 0 ? ix : 400 + n;
  }

  function gradeLabelFromKeyStr(sk) {
    var n = Number(sk);
    if (isNaN(n)) return sk;
    return gradeAxisLabel(n);
  }

  /**
   * Per-grade counts for students attending schoolObjectId whose hex centroid falls inside isoGeometry.
   */
  function travelShedGradeCountsInIsochrone(isoGeometry, schoolObjectId) {
    if (
      !GRADE_COUNTS_BY_SCHOOL_HEX ||
      !STUDENT_HEX_INDEX ||
      !STUDENT_HEX_INDEX.geometryByHexKey ||
      !isoGeometry
    ) {
      return null;
    }
    if (
      typeof turf === "undefined" ||
      !turf ||
      typeof turf.point !== "function" ||
      typeof turf.feature !== "function" ||
      typeof turf.booleanPointInPolygon !== "function"
    ) {
      return null;
    }
    var sid = String(schoolObjectId);
    var bySchool = GRADE_COUNTS_BY_SCHOOL_HEX[sid];
    if (!bySchool) {
      return {};
    }
    var polyFeat;
    try {
      polyFeat = turf.feature(isoGeometry);
    } catch (ePoly) {
      return null;
    }
    var bbox;
    try {
      bbox = turf.bbox(polyFeat);
    } catch (eB) {
      bbox = null;
    }
    var totalByGrade = Object.create(null);
    var geomBy = STUDENT_HEX_INDEX.geometryByHexKey;
    for (var hk in bySchool) {
      if (!Object.prototype.hasOwnProperty.call(bySchool, hk)) continue;
      var geom = geomBy[hk];
      if (!geom) continue;
      var c1 = polygonCentroid(geom);
      if (!c1 || c1.length < 2) continue;
      if (bbox && bbox.length === 4) {
        if (
          c1[0] < bbox[0] ||
          c1[0] > bbox[2] ||
          c1[1] < bbox[1] ||
          c1[1] > bbox[3]
        ) {
          continue;
        }
      }
      var ptf;
      try {
        ptf = turf.point(c1);
      } catch (eP) {
        continue;
      }
      var ins;
      try {
        ins = turf.booleanPointInPolygon(ptf, polyFeat);
      } catch (eI) {
        continue;
      }
      if (!ins) continue;
      var gch = bySchool[hk];
      if (!gch) continue;
      for (var gkx in gch) {
        if (!Object.prototype.hasOwnProperty.call(gch, gkx)) continue;
        totalByGrade[gkx] = (totalByGrade[gkx] || 0) + gch[gkx];
      }
    }
    return totalByGrade;
  }

  function pickIsochroneFeatureAtLngLat(lngLat, isoFc) {
    if (
      !isoFc ||
      !isoFc.features ||
      !isoFc.features.length ||
      typeof turf === "undefined" ||
      !turf ||
      typeof turf.point !== "function" ||
      typeof turf.feature !== "function" ||
      typeof turf.booleanPointInPolygon !== "function"
    ) {
      return null;
    }
    var pt = turf.point([lngLat.lng, lngLat.lat]);
    var candidates = [];
    for (var i = 0; i < isoFc.features.length; i++) {
      var f = isoFc.features[i];
      if (!f || !f.geometry) continue;
      try {
        var poly = turf.feature(f.geometry);
        if (turf.booleanPointInPolygon(pt, poly)) {
          candidates.push(f);
        }
      } catch (e) {
        /* ignore */
      }
    }
    if (!candidates.length) return null;
    candidates.sort(function (a, b) {
      var da = a.properties && a.properties.iso_dist_mi != null ? Number(a.properties.iso_dist_mi) : 0;
      var db = b.properties && b.properties.iso_dist_mi != null ? Number(b.properties.iso_dist_mi) : 0;
      return da - db;
    });
    return candidates[0];
  }

  function formatTravelShedTooltipMiles(mi) {
    if (mi == null || !isFinite(Number(mi))) return "—";
    return Number(mi).toFixed(1);
  }

  /**
   * Travel shed tooltip title: "[Attendance] students within X.X mi of [Reference]" (same logic as calculator).
   * Percent column = ring count ÷ that grade’s total at the attendance school.
   */
  function formatMilfordTravelShedHtml(
    totalByGrade,
    referenceSchoolName,
    milesForRing,
    schoolTotalsByGrade,
    attendanceSchoolName
  ) {
    var refNm = referenceSchoolName != null ? String(referenceSchoolName) : "Reference school";
    var miStr = formatTravelShedTooltipMiles(milesForRing);
    var attNm =
      attendanceSchoolName != null && String(attendanceSchoolName).trim() !== ""
        ? String(attendanceSchoolName)
        : "";
    if (!attNm) {
      return (
        '<div class="travel-shed-hover-inner travel-shed-hover-inner--residence">' +
        '<div class="travel-shed-hover-title">' +
        "Within " +
        (miStr !== "—" ? escapeHtml(miStr) : "—") +
        " mi of " +
        escapeHtml(refNm) +
        "</div>" +
        '<p class="travel-shed-residence-empty">Select a school in the menu at the top to see grade-level counts.</p></div>'
      );
    }
    var titleLine =
      escapeHtml(attNm) +
      " students within " +
      (miStr !== "—" ? escapeHtml(miStr) : "—") +
      " mi of " +
      escapeHtml(refNm);
    var schoolTotals = schoolTotalsByGrade || {};
    if (!totalByGrade || !Object.keys(totalByGrade).length) {
      return (
        '<div class="travel-shed-hover-inner travel-shed-hover-inner--residence">' +
        '<div class="travel-shed-hover-title">' +
        titleLine +
        "</div>" +
        '<p class="travel-shed-residence-empty">No students attending ' +
        escapeHtml(attNm) +
        " with hex centroids inside this ring (distance from " +
        escapeHtml(refNm) +
        ").</p></div>"
      );
    }
    var keys = Object.keys(totalByGrade);
    keys.sort(function (a, b) {
      return travelShedGradeSortKeyMilford(a) - travelShedGradeSortKeyMilford(b);
    });
    var ringTotal = 0;
    var ri;
    for (ri = 0; ri < keys.length; ri++) {
      ringTotal += Number(totalByGrade[keys[ri]]) || 0;
    }
    var schoolGrandTotal = sumEnrollmentCounts(schoolTotals);
    var headerHtml =
      '<div class="travel-shed-residence-header">' +
      '<span class="travel-shed-residence-grade">Grade</span>' +
      '<span class="travel-shed-residence-h-n">Students</span>' +
      '<span class="travel-shed-residence-pct-h">%</span></div>';
    function rowHtml(ckey) {
      var nct = Number(totalByGrade[ckey]) || 0;
      var lab = gradeLabelFromKeyStr(ckey);
      var numStr = nct.toLocaleString();
      var denom = Number(schoolTotals[ckey]) || 0;
      var pctStr;
      if (denom > 0) {
        pctStr = ((nct / denom) * 100).toFixed(1) + "%";
      } else {
        pctStr = nct > 0 ? "—" : "0.0%";
      }
      return (
        '<div class="travel-shed-residence-row">' +
        '<span class="travel-shed-residence-grade">' +
        escapeHtml(lab) +
        '</span><span class="travel-shed-residence-n">' +
        escapeHtml(numStr) +
        '</span><span class="travel-shed-residence-pct">' +
        escapeHtml(pctStr) +
        "</span></div>"
      );
    }
    var footerPct =
      schoolGrandTotal > 0
        ? ((ringTotal / schoolGrandTotal) * 100).toFixed(1) + "%"
        : "—";
    var allGradesFooter =
      '<div class="travel-shed-residence-footer">' +
      '<div class="travel-shed-residence-row travel-shed-residence-row--all-grades">' +
      '<span class="travel-shed-residence-grade">All grades</span>' +
      '<span class="travel-shed-residence-n">' +
      escapeHtml(ringTotal.toLocaleString()) +
      '</span><span class="travel-shed-residence-pct">' +
      footerPct +
      "</span></div></div>";
    var nK = keys.length;
    var useTwoCols = nK > 5;
    var mid = Math.ceil(nK / 2);
    var kLeft = useTwoCols ? keys.slice(0, mid) : keys;
    var kRight = useTwoCols ? keys.slice(mid) : [];
    var i3;
    var leftRows = [];
    for (i3 = 0; i3 < kLeft.length; i3++) {
      leftRows.push(rowHtml(kLeft[i3]));
    }
    var rightRows = [];
    for (i3 = 0; i3 < kRight.length; i3++) {
      rightRows.push(rowHtml(kRight[i3]));
    }
    var tableBody;
    if (!useTwoCols) {
      tableBody =
        '<div class="travel-shed-residence-grades travel-shed-residence-grades--1col">' +
        headerHtml +
        '<div class="travel-shed-residence-rows">' +
        leftRows.join("") +
        "</div></div>" +
        allGradesFooter;
    } else {
      tableBody =
        '<div class="travel-shed-residence-grades travel-shed-residence-grades--2col">' +
        '<div class="travel-shed-residence-pane">' +
        headerHtml +
        '<div class="travel-shed-residence-rows">' +
        leftRows.join("") +
        "</div></div>" +
        '<div class="travel-shed-residence-pane">' +
        headerHtml +
        '<div class="travel-shed-residence-rows">' +
        rightRows.join("") +
        "</div></div></div>" +
        allGradesFooter;
    }
    return (
      '<div class="travel-shed-hover-inner travel-shed-hover-inner--residence">' +
      '<div class="travel-shed-hover-title">' +
      titleLine +
      "</div>" +
      tableBody +
      "</div>"
    );
  }

  function formatStudentsPerSqMiForUi(v) {
    if (v == null || !isFinite(v)) return "—";
    return Math.round(Number(v)).toLocaleString();
  }

  function minMaxNeighborhoodSchoolDensitiesInViewForLegend() {
    if (!map || !map.getSource("student-hex")) {
      return { min: null, max: null };
    }
    var b;
    try {
      b = map.getBounds();
    } catch (e) {
      return { min: null, max: null };
    }
    var features;
    try {
      features = map.querySourceFeatures("student-hex", {});
    } catch (e2) {
      return { min: null, max: null };
    }
    if (!features || !features.length) {
      return { min: null, max: null };
    }
    var preIdx = buildDisplayCountsByHex();
    if (preIdx == null) {
      preIdx = Object.create(null);
    }
    var minC = null;
    var maxC = null;
    for (var i = 0; i < features.length; i++) {
      var f = features[i];
      if (!f || !f.properties) continue;
      var g = f.geometry;
      if (!g || g.type !== "Point" || !g.coordinates) continue;
      var lng = g.coordinates[0];
      var lat = g.coordinates[1];
      var ll;
      try {
        ll = new mapboxgl.LngLat(lng, lat);
      } catch (e3) {
        continue;
      }
      if (!b.contains(ll)) continue;
      var c = null;
      var hk = f.properties._hexKey != null ? String(f.properties._hexKey) : null;
      if (hk) {
        c = neighborhoodAverageSchoolResidenceStudentsPerSqMi(hk, preIdx);
      }
      if (c == null || !isFinite(c)) {
        if (f.properties.students_per_sq_mi == null) continue;
        c = Number(f.properties.students_per_sq_mi);
        if (!isFinite(c)) continue;
      }
      if (minC == null || c < minC) minC = c;
      if (maxC == null || c > maxC) maxC = c;
    }
    return { min: minC, max: maxC };
  }

  function visibleSchoolHitLayerIds() {
    var pairs = [
      ["toggle-school-elementary", "schools-elementary"],
      ["toggle-school-middle", "schools-middle"],
      ["toggle-school-high", "schools-high"],
    ];
    var out = [];
    for (var i = 0; i < pairs.length; i++) {
      var el = document.getElementById(pairs[i][0]);
      if (el && el.checked && map.getLayer(pairs[i][1])) {
        try {
          if (map.getLayoutProperty(pairs[i][1], "visibility") === "visible") {
            out.push(pairs[i][1]);
          }
        } catch (e) {
          /* ignore */
        }
      }
    }
    return out;
  }

  function studentHexResidenceHoverHtmlMilford(props, cohortPhrase) {
    var showD;
    var hk = props && props._hexKey != null ? String(props._hexKey) : null;
    if (hk) {
      var aggB = neighborhoodAverageSchoolResidenceStudentsPerSqMi(hk);
      if (aggB != null && isFinite(aggB)) {
        showD = aggB;
      }
    }
    if (showD == null || !isFinite(showD)) {
      var rawD =
        props && props.students_per_sq_mi != null ? Number(props.students_per_sq_mi) : NaN;
      showD = rawD;
    }
    var rawC = props && props.count != null ? Number(props.count) : NaN;
    var phrase =
      cohortPhrase != null && String(cohortPhrase).trim() !== ""
        ? String(cohortPhrase).trim()
        : "selected cohort";
    var main =
      '<div class="student-hex-hover-inner">' +
      '<div class="student-hex-hover-line">' +
      '<span class="student-hex-hover-value">' +
      escapeHtml(formatStudentsPerSqMiForUi(showD)) +
      "</span>" +
      '<span class="student-hex-hover-unit"> students per square mile</span></div>';
    var sub = "";
    if (!isNaN(rawC) && rawC > 3) {
      sub =
        '<div class="student-hex-hover-sub">' +
        escapeHtml(rawC.toLocaleString()) +
        " student residence" +
        (rawC === 1 ? "" : "s") +
        " in this hex (" +
        escapeHtml(phrase) +
        ")</div>";
    }
    return main + sub + "</div>";
  }

  function ringCentroid(ring) {
    if (!ring || ring.length < 2) return null;
    var n = ring.length - 1;
    var sx = 0;
    var sy = 0;
    for (var i = 0; i < n; i++) {
      sx += ring[i][0];
      sy += ring[i][1];
    }
    return [sx / n, sy / n];
  }

  function polygonCentroid(geometry) {
    if (!geometry || !geometry.type) return null;
    if (geometry.type === "Polygon") {
      return ringCentroid(geometry.coordinates[0]);
    }
    if (geometry.type === "MultiPolygon") {
      var best = null;
      var bestLen = -1;
      for (var p = 0; p < geometry.coordinates.length; p++) {
        var ring = geometry.coordinates[p][0];
        if (!ring || ring.length < 2) continue;
        var c = ringCentroid(ring);
        if (!c) continue;
        if (ring.length > bestLen) {
          bestLen = ring.length;
          best = c;
        }
      }
      return best;
    }
    return null;
  }

  function hexPolygonAreaSqMeters(geom) {
    if (
      typeof turf === "undefined" ||
      !turf ||
      typeof turf.area !== "function" ||
      !geom ||
      (geom.type !== "Polygon" && geom.type !== "MultiPolygon")
    ) {
      return null;
    }
    try {
      var sq = turf.area({ type: "Feature", geometry: geom });
      return sq != null && isFinite(sq) && sq > 0 ? sq : null;
    } catch (e) {
      return null;
    }
  }

  function studentsPerSqMiFromCountAndGeom(count, geom) {
    if (count == null || count <= 0 || !geom) return null;
    var sqM = hexPolygonAreaSqMeters(geom);
    if (sqM == null || sqM <= 0) return null;
    var sqMi = sqM / SQ_METERS_PER_SQ_MI;
    if (!(sqMi > 0)) return null;
    var v = count / sqMi;
    if (!isFinite(v)) return null;
    return Math.round(v);
  }

  /**
   * Undirected adjacency: hex polygons that share an edge (Brevard K-8 dashboard).
   * @param {Object<string, *>} geometryByHexKey
   * @returns {Object<string, string[]>|null}
   */
  function buildHexNeighborMap(geometryByHexKey) {
    if (!geometryByHexKey) {
      return null;
    }
    var boolTouches = null;
    if (typeof turf !== "undefined" && turf) {
      if (typeof turf.booleanTouches === "function") {
        boolTouches = turf.booleanTouches;
      } else if (typeof turf.booleanTouch === "function") {
        boolTouches = turf.booleanTouch;
      }
    }
    if (boolTouches == null || typeof turf.feature !== "function") {
      return null;
    }
    var keys = Object.keys(geometryByHexKey);
    if (!keys.length) {
      return {};
    }
    var n = keys.length;
    if (n === 1) {
      var o1 = Object.create(null);
      o1[keys[0]] = [];
      return o1;
    }
    var CELL = 0.12;
    var bucket = Object.create(null);
    for (var bi = 0; bi < n; bi++) {
      var kB = keys[bi];
      var cB = polygonCentroid(geometryByHexKey[kB]);
      if (!cB || cB.length < 2) {
        continue;
      }
      var cxb = Math.floor(cB[0] / CELL);
      var cyb = Math.floor(cB[1] / CELL);
      var bid = cxb + "," + cyb;
      if (!bucket[bid]) {
        bucket[bid] = [];
      }
      bucket[bid].push(kB);
    }
    var neighbors = Object.create(null);
    for (var ni = 0; ni < n; ni++) {
      neighbors[keys[ni]] = [];
    }
    for (var i = 0; i < n; i++) {
      var k1 = keys[i];
      var c1 = polygonCentroid(geometryByHexKey[k1]);
      if (!c1 || c1.length < 2) {
        continue;
      }
      var cx1 = Math.floor(c1[0] / CELL);
      var cy1 = Math.floor(c1[1] / CELL);
      for (var ddx = -1; ddx <= 1; ddx++) {
        for (var ddy = -1; ddy <= 1; ddy++) {
          var bList = bucket[cx1 + ddx + "," + (cy1 + ddy)];
          if (!bList) {
            continue;
          }
          for (var t = 0; t < bList.length; t++) {
            var k2 = bList[t];
            if (k2 === k1) {
              continue;
            }
            if (k2 <= k1) {
              continue;
            }
            var g1 = geometryByHexKey[k1];
            var g2 = geometryByHexKey[k2];
            if (!g1 || !g2) {
              continue;
            }
            var touches = false;
            try {
              touches = boolTouches(turf.feature(g1), turf.feature(g2));
            } catch (eAdj) {
              /* ignore */
            }
            if (touches) {
              neighbors[k1].push(k2);
              neighbors[k2].push(k1);
            }
          }
        }
      }
    }
    return neighbors;
  }

  /**
   * Mean students/sq mi over center hex + edge-adjacent hexes (Brevard smoothing rules).
   */
  function neighborhoodAverageSchoolResidenceStudentsPerSqMi(centerHexKey, prebuiltIdx) {
    if (!STUDENT_HEX_INDEX || !STUDENT_HEX_INDEX.geometryByHexKey) {
      return null;
    }
    var geomBy = STUDENT_HEX_INDEX.geometryByHexKey;
    var hk0 = String(centerHexKey);
    if (!Object.prototype.hasOwnProperty.call(geomBy, hk0)) {
      return null;
    }
    var nbrs =
      (STUDENT_HEX_INDEX.neighborsByHexKey && STUDENT_HEX_INDEX.neighborsByHexKey[hk0]) || [];
    var idx;
    if (prebuiltIdx !== undefined) {
      idx = prebuiltIdx;
    } else {
      idx = buildDisplayCountsByHex();
    }
    if (idx == null) {
      idx = Object.create(null);
    }
    var totalD = 0;
    var nH = 0;
    var keysH = [hk0].concat(nbrs);
    var seenH = Object.create(null);
    for (var i = 0; i < keysH.length; i++) {
      var hk = keysH[i];
      if (seenH[hk]) {
        continue;
      }
      seenH[hk] = true;
      if (!Object.prototype.hasOwnProperty.call(geomBy, hk)) {
        continue;
      }
      nH += 1;
      var g = geomBy[hk];
      var cnt = 0;
      if (Object.prototype.hasOwnProperty.call(idx, hk)) {
        cnt = Number(idx[hk]) || 0;
      }
      if (cnt <= 0) {
        continue;
      }
      var dens = studentsPerSqMiFromCountAndGeom(cnt, g);
      totalD += dens != null && isFinite(dens) ? dens : 0;
    }
    if (nH === 0) {
      return null;
    }
    return Math.round(totalD / nH);
  }

  function studentHexIdKeyFromProperties(p) {
    if (!p) return null;
    var hexKey = FIELD_MAP.hexId;
    var id =
      prop(p, hexKey) != null
        ? prop(p, hexKey)
        : p.GRID_ID != null
          ? p.GRID_ID
          : p.HEX_ID != null
            ? p.HEX_ID
            : p.hex_id != null
              ? p.hex_id
              : p.OBJECTID != null
                ? p.OBJECTID
                : p.FID != null
                  ? p.FID
                  : null;
    if (id != null && id !== "") {
      return "id:" + String(id);
    }
    return null;
  }

  function studentHexKey(feature) {
    var p = feature.properties || {};
    var fromId = studentHexIdKeyFromProperties(p);
    if (fromId) return fromId;
    return "geom:" + JSON.stringify(feature.geometry);
  }

  function buildStudentHexIndex(fc) {
    var countsByMsid = {};
    var geometryByHexKey = {};
    if (!fc || !fc.features) {
      return {
        countsByMsid: countsByMsid,
        geometryByHexKey: geometryByHexKey,
        neighborsByHexKey: Object.create(null),
      };
    }
    for (var i = 0; i < fc.features.length; i++) {
      var f = fc.features[i];
      var p = f.properties || {};
      var oid = resolveSchoolObjectId(hexAssignedSchoolNameFromProps(p));
      if (oid == null) continue;
      var msid = Number(oid);
      if (isNaN(msid)) continue;
      var key = studentHexKey(f);
      if (!geometryByHexKey[key]) {
        geometryByHexKey[key] = f.geometry;
      }
      var sk = String(msid);
      if (!countsByMsid[sk]) countsByMsid[sk] = {};
      countsByMsid[sk][key] = (countsByMsid[sk][key] || 0) + 1;
    }
    var neighborsByHexKey = buildHexNeighborMap(geometryByHexKey);
    if (!neighborsByHexKey) {
      neighborsByHexKey = Object.create(null);
    }
    return {
      countsByMsid: countsByMsid,
      geometryByHexKey: geometryByHexKey,
      neighborsByHexKey: neighborsByHexKey,
    };
  }

  function buildAllSchoolsHexCounts() {
    if (!STUDENT_HEX_INDEX || !STUDENT_HEX_INDEX.countsByMsid) return null;
    var byM = STUDENT_HEX_INDEX.countsByMsid;
    var out = Object.create(null);
    for (var msk in byM) {
      if (!Object.prototype.hasOwnProperty.call(byM, msk)) continue;
      var hmap = byM[msk];
      for (var hk in hmap) {
        if (!Object.prototype.hasOwnProperty.call(hmap, hk)) continue;
        var c = Number(hmap[hk]) || 0;
        if (c <= 0) continue;
        out[hk] = (out[hk] || 0) + c;
      }
    }
    return Object.keys(out).length ? out : null;
  }

  function buildDisplayCountsByHex() {
    if (!STUDENT_HEX_INDEX) return null;
    var sel = document.getElementById("school-select");
    var raw =
      sel && sel.value !== "" && sel.value != null ? Number(sel.value) : NaN;
    if (sel && sel.value !== "" && !isNaN(raw)) {
      var hm = STUDENT_HEX_INDEX.countsByMsid[String(raw)];
      return hm && typeof hm === "object" ? hm : null;
    }
    return buildAllSchoolsHexCounts();
  }

  function buildIsochroneFillColor() {
    var stops = [
      "interpolate",
      ["linear"],
      ["to-number", ["get", "iso_ring"]],
      1,
      "#fffbeb",
      2,
      "#fff7d6",
      3,
      "#fef3c7",
      4,
      "#fde68a",
      5,
      "#fcd34d",
      6,
      "#fbbf24",
      7,
      "#f59e0b",
      8,
      "#d97706",
      9,
      "#b45309",
      10,
      "#92400e",
      12,
      "#78350f",
      14,
      "#5c2e0e",
      16,
      "#4a2510",
      18,
      "#451a03",
      20,
      "#3d1608",
    ];
    return stops;
  }

  function buildIsochroneFillOpacity() {
    /** ~30% lighter than prior ramp (multiply prior stops by 0.7). */
    return [
      "interpolate",
      ["linear"],
      ["to-number", ["get", "iso_ring"]],
      1,
      0.364,
      4,
      0.294,
      8,
      0.21,
      12,
      0.154,
      16,
      0.098,
      20,
      0.07,
    ];
  }

  function isoFeatureUid(props) {
    if (!props) return null;
    var sid = props.iso_school_id;
    var bk = props.iso_break_m;
    if (sid == null || bk == null || bk === "") return null;
    return String(sid) + "_" + String(bk);
  }

  function clearAllIsochroneHoverState() {
    if (!map || !map.getSource("school-isochrones") || hoveredIsochroneUid == null) {
      hoveredIsochroneUid = null;
      return;
    }
    try {
      map.setFeatureState({ source: "school-isochrones", id: hoveredIsochroneUid }, { hover: false });
    } catch (e) {}
    hoveredIsochroneUid = null;
  }

  function setIsochroneHoverFeature(uid) {
    if (!map || !map.getSource("school-isochrones") || uid == null || uid === "") return;
    if (hoveredIsochroneUid === uid) return;
    clearAllIsochroneHoverState();
    hoveredIsochroneUid = uid;
    try {
      map.setFeatureState({ source: "school-isochrones", id: uid }, { hover: true });
    } catch (e2) {
      hoveredIsochroneUid = null;
    }
  }

  function buildSchoolIsochronesEnriched(fc) {
    if (!fc || !fc.features || !fc.features.length) {
      return { type: "FeatureCollection", features: [] };
    }
    var nameKey = FIELD_MAP.isoName;
    var toBreakKey = FIELD_MAP.isoToBreak;
    var out = [];
    for (var i = 0; i < fc.features.length; i++) {
      var f = fc.features[i];
      if (!f) continue;
      var p = f.properties || {};
      var rawName = prop(p, nameKey) != null ? prop(p, nameKey) : p.name;
      var schoolLabel = stripIsochroneNamePrefix(rawName);
      var sid = resolveSchoolObjectId(schoolLabel);
      if (sid == null) continue;
      var toBreakM =
        prop(p, toBreakKey) != null && prop(p, toBreakKey) !== ""
          ? Number(prop(p, toBreakKey))
          : NaN;
      if (isNaN(toBreakM) || toBreakM < 0) continue;
      var distMi = toBreakM / METERS_PER_MILE;
      var ring = Math.round(distMi / ISO_STEP_MI);
      if (ring < 1) ring = 1;
      if (ring > MAX_ISO_RING) ring = MAX_ISO_RING;
      var pr = Object.assign({}, p, {
        iso_school_id: sid,
        iso_break_m: toBreakM,
        iso_dist_mi: distMi,
        iso_ring: ring,
      });
      out.push({ type: "Feature", geometry: f.geometry, properties: pr });
    }
    out.sort(function (a, b) {
      return (b.properties.iso_break_m || 0) - (a.properties.iso_break_m || 0);
    });
    return { type: "FeatureCollection", features: out };
  }

  /**
   * Largest network isochrone ring for referenceObjectId whose travel distance is ≤ maxDistMi (nested cumulative polygons).
   */
  function isochroneGeometryForSchoolWithinMaxMi(referenceObjectId, maxDistMi) {
    if (!SCHOOL_ISO_ENRICHED || !SCHOOL_ISO_ENRICHED.features) return null;
    var rid = Number(referenceObjectId);
    if (isNaN(rid)) return null;
    var bestGeom = null;
    var bestBreak = -Infinity;
    var fi;
    for (fi = 0; fi < SCHOOL_ISO_ENRICHED.features.length; fi++) {
      var f = SCHOOL_ISO_ENRICHED.features[fi];
      if (!f || !f.properties || !f.geometry) continue;
      if (Number(f.properties.iso_school_id) !== rid) continue;
      var d = Number(f.properties.iso_dist_mi);
      if (isNaN(d) || d > maxDistMi + 1e-6) continue;
      var br = Number(f.properties.iso_break_m);
      if (isNaN(br)) br = -Infinity;
      if (br > bestBreak) {
        bestBreak = br;
        bestGeom = f.geometry;
      }
    }
    return bestGeom;
  }

  function syncIsochroneLayerData() {
    if (!map || !map.getSource("school-isochrones")) return;
    clearAllIsochroneHoverState();
    var full = SCHOOL_ISO_ENRICHED;
    var outFc = { type: "FeatureCollection", features: [] };
    var tgl = document.getElementById("toggle-travel-sheds");
    var shedOn = !!(tgl && tgl.checked);
    if (!shedOn || !full || !full.features || !full.features.length) {
      try {
        map.getSource("school-isochrones").setData(outFc);
      } catch (e) {}
      LAST_ISOCHRONE_DISPLAY_FC = outFc;
      return;
    }
    var refSel = document.getElementById("proximity-reference-school");
    var ms =
      refSel && refSel.value !== "" && refSel.value != null
        ? Number(refSel.value)
        : NaN;
    if (ms == null || isNaN(ms)) {
      try {
        map.getSource("school-isochrones").setData(outFc);
      } catch (e2) {}
      LAST_ISOCHRONE_DISPLAY_FC = outFc;
      return;
    }
    var maxM = travelShedMaxHalfSteps * ISO_STEP_MI;
    if (isNaN(maxM) || maxM < ISO_STEP_MI) maxM = MAX_TRAVEL_MI;
    if (maxM > MAX_TRAVEL_MI) maxM = MAX_TRAVEL_MI;
    var mNum = Number(ms);
    var matched = [];
    for (var i = 0; i < full.features.length; i++) {
      var f0 = full.features[i];
      if (!f0 || !f0.properties) continue;
      if (Number(f0.properties.iso_school_id) !== mNum) continue;
      var dMi = Number(f0.properties.iso_dist_mi);
      if (isNaN(dMi)) continue;
      if (dMi <= maxM + 1e-6) {
        matched.push(f0);
      }
    }
    var maxBreak = -1;
    for (var j = 0; j < matched.length; j++) {
      var rj = Number(
        matched[j].properties != null ? matched[j].properties.iso_break_m : NaN
      );
      if (!isNaN(rj) && rj > maxBreak) maxBreak = rj;
    }
    for (var k = 0; k < matched.length; k++) {
      var fk = matched[k];
      var pk = fk.properties || {};
      var bk = Number(pk.iso_break_m);
      var isO = !isNaN(bk) && maxBreak >= 0 && bk === maxBreak;
      var uid = isoFeatureUid(pk);
      outFc.features.push({
        type: "Feature",
        geometry: fk.geometry,
        properties: Object.assign({}, pk, {
          iso_outer: isO ? "yes" : "no",
          _dash_iso_uid: uid != null ? uid : "",
        }),
      });
    }
    try {
      map.getSource("school-isochrones").setData(outFc);
    } catch (e3) {}
    LAST_ISOCHRONE_DISPLAY_FC = outFc;
  }

  function studentHexLayersZoomAllowsDensity() {
    if (!map) return true;
    try {
      return map.getZoom() <= STUDENT_RESIDENCE_DENSITY_MAX_ZOOM;
    } catch (ez) {
      return true;
    }
  }

  function applyStudentHexZoomVisibility() {
    if (!map) return;
    var tgl = document.getElementById("toggle-student-hex");
    var heatOn = !!(tgl && tgl.checked);
    var zoomOk = studentHexLayersZoomAllowsDensity();
    var show = heatOn && studentHexLayerFeatureCount > 0 && zoomOk;
    var vis = show ? "visible" : "none";
    try {
      if (map.getLayer("student-hex-heatmap")) {
        map.setLayoutProperty("student-hex-heatmap", "visibility", vis);
      }
      if (map.getLayer("student-hex-hit-fill")) {
        map.setLayoutProperty("student-hex-hit-fill", "visibility", vis);
      }
    } catch (eLay) {
      /* ignore */
    }
    var legRow = document.getElementById("map-density-legend-student-row");
    if (legRow) {
      legRow.hidden = !show;
    }
  }

  function applyResidenceHeatmapSymbology() {
    if (!map || !map.getLayer("student-hex-heatmap")) return;
    var sel = document.getElementById("school-select");
    var hasSchool = sel && sel.value !== "";
    var useSchoolRamp = !!hasSchool;
    try {
      map.setPaintProperty(
        "student-hex-heatmap",
        "heatmap-color",
        useSchoolRamp ? HEAT_STUDENT_RAMP_SCHOOL : HEAT_STUDENT_RAMP_UNIFORM
      );
      map.setPaintProperty(
        "student-hex-heatmap",
        "heatmap-intensity",
        useSchoolRamp ? ["*", 1.4, HEAT_RESIDENCE_INTENSITY] : HEAT_RESIDENCE_INTENSITY
      );
    } catch (e) {}
  }

  function syncStudentHexLayer() {
    if (!map || !map.getSource("student-hex")) return;
    function empty() {
      studentHexLayerFeatureCount = 0;
      map.getSource("student-hex").setData({ type: "FeatureCollection", features: [] });
      if (map.getSource("student-hex-hit")) {
        map.getSource("student-hex-hit").setData({ type: "FeatureCollection", features: [] });
      }
      if (map.getLayer("student-hex-heatmap")) {
        map.setLayoutProperty("student-hex-heatmap", "visibility", "none");
      }
      if (map.getLayer("student-hex-hit-fill")) {
        map.setLayoutProperty("student-hex-hit-fill", "visibility", "none");
      }
      var legRow = document.getElementById("map-density-legend-student-row");
      if (legRow) {
        legRow.hidden = true;
      }
    }
    var tgl = document.getElementById("toggle-student-hex");
    if (!tgl || !tgl.checked) {
      empty();
      return;
    }
    if (!STUDENT_HEX_INDEX || !STUDENT_HEX_INDEX.countsByMsid) {
      empty();
      return;
    }
    var idx = buildDisplayCountsByHex();
    if (idx == null) {
      empty();
      return;
    }
    var features = [];
    var hitFeatures = [];
    for (var key in idx) {
      if (!Object.prototype.hasOwnProperty.call(idx, key)) continue;
      var cnt = idx[key];
      if (cnt <= 0) continue;
      var geom = STUDENT_HEX_INDEX.geometryByHexKey[key];
      if (!geom) continue;
      var pt = polygonCentroid(geom);
      if (!pt) continue;
      var dens = studentsPerSqMiFromCountAndGeom(cnt, geom);
      features.push({
        type: "Feature",
        properties: { _hexKey: key, count: cnt, students_per_sq_mi: dens },
        geometry: { type: "Point", coordinates: pt },
      });
      hitFeatures.push({
        type: "Feature",
        properties: { _hexKey: key, count: cnt, students_per_sq_mi: dens },
        geometry: geom,
      });
    }
    if (features.length === 0) {
      empty();
      return;
    }
    studentHexLayerFeatureCount = features.length;
    map.getSource("student-hex").setData({ type: "FeatureCollection", features: features });
    if (map.getSource("student-hex-hit")) {
      map.getSource("student-hex-hit").setData({
        type: "FeatureCollection",
        features: hitFeatures,
      });
    }
    applyResidenceHeatmapSymbology();
    applyStudentHexZoomVisibility();
    refreshDensityLegend();
  }

  var legendRefreshTimer = null;
  function refreshDensityLegend() {
    if (legendRefreshTimer) clearTimeout(legendRefreshTimer);
    legendRefreshTimer = setTimeout(function () {
      legendRefreshTimer = null;
      var minEl = document.getElementById("map-density-legend-student-min");
      var maxEl = document.getElementById("map-density-legend-student-max");
      var bar = document.getElementById("map-density-legend-student-scale");
      if (!minEl || !maxEl || !map || !map.getSource("student-hex")) return;
      var r = minMaxNeighborhoodSchoolDensitiesInViewForLegend();
      minEl.textContent = formatStudentsPerSqMiForUi(r.min);
      maxEl.textContent = formatStudentsPerSqMiForUi(r.max);
      if (bar) {
        bar.setAttribute(
          "aria-label",
          "Student residential density in view: neighborhood-mean students per square mile from " +
            (r.min == null ? "—" : formatStudentsPerSqMiForUi(r.min)) +
            " to " +
            (r.max == null ? "—" : formatStudentsPerSqMiForUi(r.max))
        );
      }
    }, 80);
  }

  function computeBbox(fc) {
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    function walk(coords) {
      if (typeof coords[0] === "number") {
        var x = coords[0];
        var y = coords[1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        return;
      }
      for (var i = 0; i < coords.length; i++) walk(coords[i]);
    }
    if (!fc || !fc.features) return null;
    for (var f = 0; f < fc.features.length; f++) {
      var g = fc.features[f].geometry;
      if (g) walk(g.coordinates);
    }
    if (!isFinite(minX)) return null;
    return [minX, minY, maxX, maxY];
  }

  function mergeBbox(a, b) {
    if (!a) return b;
    if (!b) return a;
    return [
      Math.min(a[0], b[0]),
      Math.min(a[1], b[1]),
      Math.max(a[2], b[2]),
      Math.max(a[3], b[3]),
    ];
  }

  function clearSchoolSelectionState() {
    if (!map || !map.getSource("schools")) return;
    try {
      var fc = GEO.schools ? schoolsFeatureCollectionForMap(GEO.schools) : null;
      if (fc && fc.features) {
        for (var i = 0; i < fc.features.length; i++) {
          var id = fc.features[i].properties && fc.features[i].properties[FIELD_MAP.schoolId];
          if (id == null) continue;
          map.setFeatureState({ source: "schools", id: id }, { selected: false });
        }
      }
    } catch (e) {}
  }

  function setSelectedSchoolState(msid) {
    clearSchoolSelectionState();
    if (msid == null || isNaN(msid)) return;
    try {
      map.setFeatureState({ source: "schools", id: msid }, { selected: true });
    } catch (e) {}
  }

  function schoolMapHighlightStateAny() {
    return [
      "any",
      ["==", ["feature-state", "selected"], true],
    ];
  }

  function addAllLayers(fitBounds) {
    if (!GEO.schools) return;
    var schools = schoolsFeatureCollectionForMap(GEO.schools);
    var studentHexFc = GEO.studentHex || { type: "FeatureCollection", features: [] };
    STUDENT_HEX_INDEX =
      studentHexFc.features && studentHexFc.features.length
        ? buildStudentHexIndex(studentHexFc)
        : null;
    GRADE_COUNTS_BY_SCHOOL_HEX = buildGradeCountsBySchoolHex(studentHexFc);
    SCHOOL_ISO_ENRICHED = GEO.isochronesRaw
      ? buildSchoolIsochronesEnriched(GEO.isochronesRaw)
      : { type: "FeatureCollection", features: [] };

    var idField = FIELD_MAP.schoolId;
    map.addSource("schools", {
      type: "geojson",
      data: schools,
      promoteId: idField,
    });

    var schoolMapCircleBasePaint = {
      "circle-pitch-alignment": "map",
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        8,
        3,
        12,
        6,
        16,
        10,
      ],
      "circle-stroke-width": ["case", schoolMapHighlightStateAny(), 5.5, 1],
      "circle-stroke-opacity": 1,
      "circle-opacity": 0.92,
    };

    var typeField = FIELD_MAP.schoolType;
    map.addLayer({
      id: "schools-elementary",
      type: "circle",
      source: "schools",
      filter: ["==", ["get", typeField], "ELEMENTARY"],
      paint: Object.assign({}, schoolMapCircleBasePaint, {
        "circle-color": PALETTE.elementary.fill,
        "circle-stroke-color": [
          "case",
          schoolMapHighlightStateAny(),
          PALETTE.elementary.highlightStroke,
          "#ffffff",
        ],
      }),
    });
    map.addLayer({
      id: "schools-middle",
      type: "circle",
      source: "schools",
      filter: ["==", ["get", typeField], "MIDDLE"],
      paint: Object.assign({}, schoolMapCircleBasePaint, {
        "circle-color": PALETTE.middle.fill,
        "circle-stroke-color": [
          "case",
          schoolMapHighlightStateAny(),
          PALETTE.middle.highlightStroke,
          "#ffffff",
        ],
      }),
    });
    map.addLayer({
      id: "schools-high",
      type: "circle",
      source: "schools",
      filter: [
        "any",
        ["==", ["get", typeField], "HIGH"],
        ["==", ["get", typeField], "JR SR HIGH"],
      ],
      paint: Object.assign({}, schoolMapCircleBasePaint, {
        "circle-color": [
          "match",
          ["get", typeField],
          "HIGH",
          PALETTE.high.fill,
          "JR SR HIGH",
          PALETTE.jrSr.fill,
          PALETTE.high.fill,
        ],
        "circle-stroke-color": [
          "case",
          schoolMapHighlightStateAny(),
          [
            "match",
            ["get", typeField],
            "HIGH",
            PALETTE.high.highlightStroke,
            "JR SR HIGH",
            PALETTE.jrSr.highlightStroke,
            PALETTE.high.highlightStroke,
          ],
          "#ffffff",
        ],
      }),
    });

    map.addSource("school-isochrones", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      promoteId: "_dash_iso_uid",
    });
    map.addLayer({
      id: "school-isochrones-fill",
      type: "fill",
      source: "school-isochrones",
      paint: {
        "fill-color": buildIsochroneFillColor(),
        "fill-opacity": buildIsochroneFillOpacity(),
      },
      layout: { visibility: "none" },
    });
    map.addLayer({
      id: "school-isochrones-outline",
      type: "line",
      source: "school-isochrones",
      paint: {
        "line-color": "#ffffff",
        "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0],
        "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0],
      },
      layout: { visibility: "none" },
    });

    map.addSource("student-hex", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "student-hex-heatmap",
      type: "heatmap",
      source: "student-hex",
      paint: {
        "heatmap-weight": [
          "max",
          0,
          [
            "sqrt",
            ["max", 0, ["to-number", ["get", "count"]]],
          ],
        ],
        "heatmap-intensity": HEAT_RESIDENCE_INTENSITY,
        "heatmap-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          8,
          16,
          11,
          30,
          14,
          42,
          16,
          32,
          17,
          28,
        ],
        "heatmap-opacity": 0.88,
        "heatmap-color": HEAT_STUDENT_RAMP_UNIFORM,
      },
      layout: { visibility: "none" },
    });

    map.addSource("student-hex-hit", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "student-hex-hit-fill",
      type: "fill",
      source: "student-hex-hit",
      paint: {
        "fill-opacity": 0,
        "fill-color": "#000000",
      },
      layout: { visibility: "none" },
    });

    ["schools-elementary", "schools-middle", "schools-high"].forEach(function (lid) {
      if (map.getLayer(lid)) map.moveLayer(lid);
    });
    if (map.getLayer("school-isochrones-outline")) {
      map.moveLayer("school-isochrones-outline");
    }

    var combined = computeBbox(schools);
    combined = mergeBbox(combined, computeBbox(studentHexFc));
    combined = mergeBbox(combined, computeBbox(GEO.isochronesRaw));

    map.resize();
    if (fitBounds !== false && combined) {
      map.fitBounds(combined, { padding: 48, maxZoom: 13, duration: 0 });
    }

    syncIsochroneLayerData();
    syncStudentHexLayer();
    syncLayerToggles();

    var sel = document.getElementById("school-select");
    if (sel && sel.value) {
      var v = Number(sel.value);
      if (!isNaN(v)) {
        selectedSchoolMsid = v;
        setSelectedSchoolState(v);
      }
    }
  }

  function syncLayerToggles() {
    var pairs = [
      ["toggle-school-elementary", "schools-elementary"],
      ["toggle-school-middle", "schools-middle"],
      ["toggle-school-high", "schools-high"],
    ];
    for (var pi = 0; pi < pairs.length; pi++) {
      var inp = document.getElementById(pairs[pi][0]);
      var lid = pairs[pi][1];
      var vis = inp && inp.checked ? "visible" : "none";
      if (map.getLayer(lid)) map.setLayoutProperty(lid, "visibility", vis);
    }

    var shed = document.getElementById("toggle-travel-sheds");
    var shedVis = shed && shed.checked ? "visible" : "none";
    if (map.getLayer("school-isochrones-fill")) {
      map.setLayoutProperty("school-isochrones-fill", "visibility", shedVis);
    }
    if (map.getLayer("school-isochrones-outline")) {
      map.setLayoutProperty("school-isochrones-outline", "visibility", shedVis);
    }
    var row = document.getElementById("travel-shed-max-miles-row");
    if (row) {
      if (shed && shed.checked) row.removeAttribute("hidden");
      else row.setAttribute("hidden", "");
    }
  }

  function populateSchoolSelect(schoolsFc) {
    var sel = document.getElementById("school-select");
    if (!sel || !schoolsFc || !schoolsFc.features) return;
    var nameKey = FIELD_MAP.schoolName;
    var idKey = FIELD_MAP.schoolId;
    var hexN = hexCountsBySchoolFromHex(GEO.studentHex);
    var isoN = isoCountsBySchoolFromRaw(GEO.isochronesRaw);
    var opts = schoolsFc.features
      .map(function (ft) {
        var p = ft.properties || {};
        var id = prop(p, idKey);
        var name = prop(p, nameKey) != null ? String(prop(p, nameKey)) : String(id);
        var idStr = String(id);
        var h = hexN[idStr] || 0;
        var iso = isoN[idStr] || 0;
        var incomplete = h === 0 || iso === 0;
        var label = name + (incomplete ? " (no data)" : "");
        return { id: id, name: name, label: label };
      })
      .filter(function (x) {
        if (x.id == null || x.id === "") return false;
        if (x.name === PLATT_TECHNICAL_SCHOOL_NAME) return false;
        return true;
      });
    opts.sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
    while (sel.options.length > 1) {
      sel.remove(1);
    }
    for (var i = 0; i < opts.length; i++) {
      var o = document.createElement("option");
      o.value = String(opts[i].id);
      o.textContent = opts[i].label;
      sel.appendChild(o);
    }
  }

  function setMapboxBasemap(mode) {
    if (!MAPBOX_STYLES[mode]) return;
    var root = document.getElementById("basemap-toggle");
    if (root) {
      root.querySelectorAll("[data-basemap]").forEach(function (btn) {
        var active = btn.getAttribute("data-basemap") === mode;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }
    map.once("style.load", function () {
      if (GEO.schools) {
        addAllLayers(false);
      }
    });
    map.setStyle(MAPBOX_STYLES[mode]);
  }

  function formatTravelMiFromSteps(steps) {
    var mi = steps * ISO_STEP_MI;
    return mi.toFixed(1) + " mi";
  }

  function updateTravelShedMilesControl() {
    var range = document.getElementById("travel-shed-max-miles");
    var out = document.getElementById("travel-shed-max-miles-output");
    if (!range) return;
    var v = Number(range.value);
    if (isNaN(v) || v < 1) v = 1;
    if (v > 10) v = 10;
    travelShedMaxHalfSteps = v;
    range.setAttribute("aria-valuenow", String(v));
    if (out) {
      out.textContent = formatTravelMiFromSteps(v);
    }
  }

  function initDashboardResizer() {
    var dashboard = document.querySelector(".dashboard");
    var sidebar = document.getElementById("dashboard-sidebar");
    var resizer = document.getElementById("dashboard-resizer");
    if (!dashboard || !sidebar || !resizer) return;
    var dragging = false;
    function clampSidebarWidth(px) {
      var rect = dashboard.getBoundingClientRect();
      var resizerW = resizer.offsetWidth || 8;
      var minSide = 240;
      var minMap = 280;
      var max = rect.width - resizerW - minMap;
      return Math.max(minSide, Math.min(max, px));
    }
    function setSidebarWidth(px) {
      px = clampSidebarWidth(px);
      sidebar.style.flex = "0 0 " + px + "px";
      sidebar.style.width = px + "px";
      map.resize();
    }
    resizer.addEventListener("mousedown", function (e) {
      dragging = true;
      e.preventDefault();
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    });
    document.addEventListener("mousemove", function (e) {
      if (!dragging) return;
      var rect = dashboard.getBoundingClientRect();
      setSidebarWidth(e.clientX - rect.left);
    });
    document.addEventListener("mouseup", function () {
      if (!dragging) return;
      dragging = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    });
  }

  mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

  map = new mapboxgl.Map({
    container: "map",
    style: MAPBOX_STYLES.light,
    center: [-73.056, 41.23],
    zoom: 11,
    maxZoom: 19,
  });

  map.addControl(new mapboxgl.NavigationControl(), "top-left");
  map.addControl(
    new mapboxgl.ScaleControl({ maxWidth: 120, unit: "imperial" }),
    "bottom-left"
  );
  map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

  function setupToolbarCollapse() {
    var btn = document.getElementById("toolbar-toggle");
    var toolbar = document.getElementById("map-toolbar");
    if (!btn || !toolbar) return;
    btn.addEventListener("click", function () {
      var collapsed = toolbar.classList.toggle("toolbar--collapsed");
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    });
  }

  function setupInteractions() {
    var schoolHoverPopup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: "300px",
      className: "school-hover-popup",
      offset: 10,
    });
    var hexPopup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: "320px",
      className: "student-hex-hover-popup",
      offset: 10,
    });
    var travelShedHoverPopup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: "430px",
      className: "travel-shed-hover-popup",
      offset: 8,
    });

    function studentResidenceTooltipPhrase() {
      var sel = document.getElementById("school-select");
      if (!sel || sel.value === "") return "all schools";
      var nm = schoolDisplayNameByObjectId(Number(sel.value));
      return nm || "selected school";
    }

    map.on("mousemove", function (e) {
      var schoolLayers = visibleSchoolHitLayerIds();
      var schoolFeats =
        schoolLayers.length > 0
          ? map.queryRenderedFeatures(e.point, { layers: schoolLayers })
          : [];
      if (schoolFeats.length) {
        hexPopup.remove();
        travelShedHoverPopup.remove();
        clearAllIsochroneHoverState();
        map.getCanvas().style.cursor = "pointer";
        schoolHoverPopup
          .setLngLat(e.lngLat)
          .setHTML(schoolHoverHtml(schoolFeats[0].properties || {}))
          .addTo(map);
        return;
      }
      schoolHoverPopup.remove();

      var stuTgl = document.getElementById("toggle-student-hex");
      var hexOn =
        stuTgl &&
        stuTgl.checked &&
        map.getLayer("student-hex-hit-fill") &&
        map.getLayoutProperty("student-hex-hit-fill", "visibility") === "visible";
      if (hexOn) {
        var hexFeats = map.queryRenderedFeatures(e.point, {
          layers: ["student-hex-hit-fill"],
        });
        if (hexFeats.length) {
          travelShedHoverPopup.remove();
          clearAllIsochroneHoverState();
          map.getCanvas().style.cursor = "default";
          var phrase = studentResidenceTooltipPhrase();
          hexPopup
            .setLngLat(e.lngLat)
            .setHTML(
              studentHexResidenceHoverHtmlMilford(hexFeats[0].properties || {}, phrase)
            )
            .addTo(map);
          return;
        }
      }
      hexPopup.remove();

      var shedTgl = document.getElementById("toggle-travel-sheds");
      var shedOn = shedTgl && shedTgl.checked;
      var refSelForShed = document.getElementById("proximity-reference-school");
      var refOidForShed =
        refSelForShed && refSelForShed.value !== "" && refSelForShed.value != null
          ? Number(refSelForShed.value)
          : NaN;
      var attendSelForShed = document.getElementById("school-select");
      var attendOidForShed =
        attendSelForShed && attendSelForShed.value !== "" && attendSelForShed.value != null
          ? Number(attendSelForShed.value)
          : NaN;
      if (
        shedOn &&
        !isNaN(refOidForShed) &&
        LAST_ISOCHRONE_DISPLAY_FC &&
        LAST_ISOCHRONE_DISPLAY_FC.features &&
        LAST_ISOCHRONE_DISPLAY_FC.features.length
      ) {
        var isoFeat = pickIsochroneFeatureAtLngLat(e.lngLat, LAST_ISOCHRONE_DISPLAY_FC);
        if (isoFeat && isoFeat.properties) {
          var isoSid = Number(isoFeat.properties.iso_school_id);
          var counts = !isNaN(attendOidForShed)
            ? travelShedGradeCountsInIsochrone(isoFeat.geometry, attendOidForShed)
            : null;
          var schoolTotalsByGrade =
            !isNaN(attendOidForShed) && GEO.studentHex != null
              ? aggregateEnrollmentByGrade(GEO.studentHex, attendOidForShed)
              : {};
          var refNm = schoolDisplayNameByObjectId(refOidForShed);
          var attendNm = !isNaN(attendOidForShed)
            ? schoolDisplayNameByObjectId(attendOidForShed)
            : null;
          var mi = isoFeat.properties.iso_dist_mi;
          var hoverUid = isoFeat.properties._dash_iso_uid || isoFeatureUid(isoFeat.properties);
          if (hoverUid) {
            setIsochroneHoverFeature(hoverUid);
          }
          map.getCanvas().style.cursor = "help";
          travelShedHoverPopup
            .setLngLat(e.lngLat)
            .setHTML(
              formatMilfordTravelShedHtml(
                counts || {},
                refNm != null ? refNm : String(isoSid),
                mi,
                schoolTotalsByGrade,
                attendNm
              )
            )
            .addTo(map);
          return;
        }
      }
      clearAllIsochroneHoverState();
      travelShedHoverPopup.remove();
      map.getCanvas().style.cursor = "";
    });

    map.on("mouseout", function () {
      schoolHoverPopup.remove();
      hexPopup.remove();
      travelShedHoverPopup.remove();
      clearAllIsochroneHoverState();
      map.getCanvas().style.cursor = "";
    });

    map.on("click", function (e) {
      var schoolLayers = visibleSchoolHitLayerIds();
      var schoolFeats =
        schoolLayers.length > 0
          ? map.queryRenderedFeatures(e.point, { layers: schoolLayers })
          : [];
      if (!schoolFeats.length) return;
      schoolHoverPopup.remove();
      clearAllIsochroneHoverState();
      var props = schoolFeats[0].properties || {};
      var oid = Number(prop(props, FIELD_MAP.schoolId));
      if (!isNaN(oid)) {
        trySelectSchoolFromMap(oid);
      }
    });

    map.on("moveend", refreshDensityLegend);
    map.on("zoomend", function () {
      applyStudentHexZoomVisibility();
      refreshDensityLegend();
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function wireUiOnce() {
    setupToolbarCollapse();
    setupInteractions();
    initDashboardResizer();

    document.getElementById("basemap-toggle").addEventListener("click", function (e) {
      var t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-basemap")) {
        setMapboxBasemap(t.getAttribute("data-basemap"));
      }
    });

    ["toggle-school-elementary", "toggle-school-middle", "toggle-school-high"].forEach(
      function (tid) {
        var el = document.getElementById(tid);
        if (el) el.addEventListener("change", syncLayerToggles);
      }
    );
    document.getElementById("toggle-student-hex").addEventListener("change", syncStudentHexLayer);
    document.getElementById("toggle-travel-sheds").addEventListener("change", function () {
      syncLayerToggles();
      syncIsochroneLayerData();
    });

    var range = document.getElementById("travel-shed-max-miles");
    if (range) {
      updateTravelShedMilesControl();
      range.addEventListener("input", function () {
        updateTravelShedMilesControl();
        syncIsochroneLayerData();
      });
    }

    var schoolSel = document.getElementById("school-select");
    schoolSel.addEventListener("change", function () {
      syncProximityReferenceToPrimarySchool();
      refreshSchoolSelectionFromSelectValue();
      syncIsochroneLayerData();
    });

    var proxRef = document.getElementById("proximity-reference-school");
    if (proxRef) {
      proxRef.addEventListener("change", function () {
        syncProximityMatrix();
        syncIsochroneLayerData();
      });
    }
    var proxRange = document.getElementById("proximity-max-miles");
    if (proxRange) {
      updateProximityMaxMilesOutput();
      proxRange.addEventListener("input", function () {
        updateProximityMaxMilesOutput();
        syncProximityMatrix();
      });
    }
  }

  function fetchGeoJsonOk(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) {
        throw new Error("Could not load " + url + " (" + r.status + " " + r.statusText + ")");
      }
      return r.json();
    });
  }

  map.on("load", function () {
    Promise.all([
      fetchGeoJsonOk(DATA.schools),
      fetchGeoJsonOk(DATA.studentHexes),
      fetchGeoJsonOk(DATA.schoolIsochrones),
    ])
      .then(function (results) {
        GEO.schools = enrichSchoolLocations(results[0]);
        rebuildSchoolNameIndexes(GEO.schools);
        GEO.studentHex = results[1];
        GEO.isochronesRaw = results[2];
        populateSchoolSelect(GEO.schools);
        populateProximityReferenceSchoolSelect();
        selectedSchoolMsid = null;
        addAllLayers(true);
        updateProximityMaxMilesOutput();
        syncEnrollmentChart();
        syncTotalEnrollmentKpi();
        syncProximityMatrix();
        if (!mapLayersInitialized) {
          mapLayersInitialized = true;
          wireUiOnce();
        }
      })
      .catch(function (err) {
        console.error("Failed to load geo data", err);
      });
  });
})();
