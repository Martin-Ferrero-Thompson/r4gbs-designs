import { promises as fs } from "fs";
import path from "path";
import { XMLParser } from "fast-xml-parser";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Trackpoint {
  lat: number;
  lon: number;
  ele: number;
  time?: string;
}

interface Waypoint {
  lat: number;
  lon: number;
  name: string;
}

interface Segment {
  name: string;
  points: Trackpoint[];
  distance: number;
  elevationGain: number;
  elevationLoss: number;
  maxAltitude: number;
  minAltitude: number;
  maxGradient: number;
  avgGradient: number;
  direction: string;
}

interface NotableClimb {
  name: string | null;
  startKm: number;
  lengthKm: number;
  avgGradient: number;
  elevationGain: number;
}

interface RouteAnalysis {
  name: string;
  totalDistance: number;
  totalElevationGain: number;
  totalElevationLoss: number;
  maxAltitude: number;
  minAltitude: number;
  startPoint: { lat: number; lon: number; ele: number };
  endPoint: { lat: number; lon: number; ele: number };
  segments: Segment[];
  notableClimbs: NotableClimb[];
}

interface LLMSegmentContent {
  name: string;
  title: string;
  direction: string;
  distance: string;
  elevationGain: string;
  terrain: string;
  narrative: string;
}

interface LLMOutput {
  overview: string;
  segments: LLMSegmentContent[];
  notableClimbs: string;
}

// ─── CLI Argument Parsing ────────────────────────────────────────────────────

function parseArgs(argv: string[]) {
  const args = argv.slice(2); // skip bun + script path
  let gpxPath: string | null = null;
  let noLlm = false;
  let model = "qwen3:14b";
  let outputDir: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--no-llm") {
      noLlm = true;
    } else if (arg === "--model" && i + 1 < args.length) {
      model = args[++i];
    } else if (arg === "--output-dir" && i + 1 < args.length) {
      outputDir = args[++i];
    } else if (!arg.startsWith("--")) {
      gpxPath = arg;
    }
  }

  if (!gpxPath) {
    console.error(
      "Usage: bun run scripts/analyze-gpx.ts <file.gpx> [--no-llm] [--model <name>] [--output-dir <dir>]"
    );
    process.exit(1);
  }

  return { gpxPath, noLlm, model, outputDir };
}

// ─── GPX Parsing ─────────────────────────────────────────────────────────────

async function parseGpx(filePath: string) {
  const xml = await fs.readFile(filePath, "utf-8");
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: true,
  });
  const doc = parser.parse(xml);
  const gpx = doc.gpx;

  // Extract metadata name
  const name: string =
    gpx.trk?.name || gpx.metadata?.name || path.basename(filePath, ".gpx");

  // Extract waypoints
  const rawWpts = gpx.wpt
    ? Array.isArray(gpx.wpt)
      ? gpx.wpt
      : [gpx.wpt]
    : [];
  const waypoints: Waypoint[] = rawWpts.map((w: any) => ({
    lat: w["@_lat"],
    lon: w["@_lon"],
    name: w.name || "Unnamed",
  }));

  // Extract trackpoints
  const trkseg = gpx.trk?.trkseg;
  const rawPts = trkseg?.trkpt
    ? Array.isArray(trkseg.trkpt)
      ? trkseg.trkpt
      : [trkseg.trkpt]
    : [];
  const trackpoints: Trackpoint[] = rawPts.map((p: any) => ({
    lat: p["@_lat"],
    lon: p["@_lon"],
    ele: p.ele ?? 0,
    time: p.time ?? undefined,
  }));

  return { name, waypoints, trackpoints };
}

// ─── Geo Utilities ───────────────────────────────────────────────────────────

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;

function haversine(a: Trackpoint, b: Trackpoint): number {
  const dLat = (b.lat - a.lat) * DEG_TO_RAD;
  const dLon = (b.lon - a.lon) * DEG_TO_RAD;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(a.lat * DEG_TO_RAD) *
      Math.cos(b.lat * DEG_TO_RAD) *
      sinLon *
      sinLon;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function cardinalDirection(from: Trackpoint, to: Trackpoint): string {
  const dLon = (to.lon - from.lon) * DEG_TO_RAD;
  const y = Math.sin(dLon) * Math.cos(to.lat * DEG_TO_RAD);
  const x =
    Math.cos(from.lat * DEG_TO_RAD) * Math.sin(to.lat * DEG_TO_RAD) -
    Math.sin(from.lat * DEG_TO_RAD) *
      Math.cos(to.lat * DEG_TO_RAD) *
      Math.cos(dLon);
  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  bearing = (bearing + 360) % 360;

  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(bearing / 45) % 8];
}

/** 5-point moving average to smooth GPS elevation noise */
function smoothElevations(points: Trackpoint[]): number[] {
  const raw = points.map((p) => p.ele);
  if (raw.length < 5) return raw;

  const smoothed: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    const start = Math.max(0, i - 2);
    const end = Math.min(raw.length - 1, i + 2);
    let sum = 0;
    let count = 0;
    for (let j = start; j <= end; j++) {
      sum += raw[j];
      count++;
    }
    smoothed.push(sum / count);
  }
  return smoothed;
}

// ─── Route Analysis ──────────────────────────────────────────────────────────

function analyzePoints(points: Trackpoint[]): {
  distance: number;
  elevationGain: number;
  elevationLoss: number;
  maxAltitude: number;
  minAltitude: number;
  maxGradient: number;
  avgGradient: number;
} {
  if (points.length === 0) {
    return {
      distance: 0,
      elevationGain: 0,
      elevationLoss: 0,
      maxAltitude: 0,
      minAltitude: 0,
      maxGradient: 0,
      avgGradient: 0,
    };
  }

  const smoothedEle = smoothElevations(points);
  let distance = 0;
  let elevationGain = 0;
  let elevationLoss = 0;
  let maxAltitude = smoothedEle[0];
  let minAltitude = smoothedEle[0];
  let maxGradient = 0;

  // For gradient: accumulate over ~100m windows
  let windowDist = 0;
  let windowEle = 0;
  const gradients: number[] = [];

  for (let i = 1; i < points.length; i++) {
    const d = haversine(points[i - 1], points[i]);
    distance += d;

    const dEle = smoothedEle[i] - smoothedEle[i - 1];
    if (dEle > 0) elevationGain += dEle;
    else elevationLoss += Math.abs(dEle);

    maxAltitude = Math.max(maxAltitude, smoothedEle[i]);
    minAltitude = Math.min(minAltitude, smoothedEle[i]);

    // Gradient calculation over rolling windows
    windowDist += d;
    windowEle += dEle;
    if (windowDist >= 0.1) {
      // 100m window
      const gradient = (windowEle / (windowDist * 1000)) * 100;
      gradients.push(gradient);
      maxGradient = Math.max(maxGradient, Math.abs(gradient));
      windowDist = 0;
      windowEle = 0;
    }
  }

  const avgGradient =
    distance > 0 ? (elevationGain / (distance * 1000)) * 100 : 0;

  return {
    distance,
    elevationGain,
    elevationLoss,
    maxAltitude,
    minAltitude,
    maxGradient,
    avgGradient,
  };
}

function findNotableClimbs(
  points: Trackpoint[],
  smoothedEle: number[]
): NotableClimb[] {
  const climbs: NotableClimb[] = [];
  let cumulDist = 0;
  let inClimb = false;
  let climbStartKm = 0;
  let climbDist = 0;
  let climbGain = 0;

  // Detect sustained climbs: >4% gradient over >0.5km
  let windowDist = 0;
  let windowEle = 0;

  for (let i = 1; i < points.length; i++) {
    const d = haversine(points[i - 1], points[i]);
    cumulDist += d;
    const dEle = smoothedEle[i] - smoothedEle[i - 1];

    windowDist += d;
    windowEle += dEle;

    if (windowDist >= 0.1) {
      const gradient = (windowEle / (windowDist * 1000)) * 100;

      if (gradient > 4) {
        if (!inClimb) {
          inClimb = true;
          climbStartKm = cumulDist - windowDist;
          climbDist = 0;
          climbGain = 0;
        }
        climbDist += windowDist;
        climbGain += Math.max(0, windowEle);
      } else if (inClimb) {
        // End of climb
        if (climbDist > 0.5 && climbGain > 50) {
          climbs.push({
            name: null,
            startKm: Math.round(climbStartKm * 10) / 10,
            lengthKm: Math.round(climbDist * 10) / 10,
            avgGradient:
              Math.round((climbGain / (climbDist * 1000)) * 100 * 10) / 10,
            elevationGain: Math.round(climbGain),
          });
        }
        inClimb = false;
      }

      windowDist = 0;
      windowEle = 0;
    }
  }

  // Close any open climb
  if (inClimb && climbDist > 0.5 && climbGain > 50) {
    climbs.push({
      name: null,
      startKm: Math.round(climbStartKm * 10) / 10,
      lengthKm: Math.round(climbDist * 10) / 10,
      avgGradient:
        Math.round((climbGain / (climbDist * 1000)) * 100 * 10) / 10,
      elevationGain: Math.round(climbGain),
    });
  }

  return climbs;
}

function buildSegments(
  trackpoints: Trackpoint[],
  waypoints: Waypoint[]
): Segment[] {
  if (trackpoints.length === 0) return [];

  // If no waypoints, auto-segment every ~50km (or treat as single segment)
  if (waypoints.length === 0) {
    const stats = analyzePoints(trackpoints);
    const first = trackpoints[0];
    const last = trackpoints[trackpoints.length - 1];
    return [
      {
        name: "Full Route",
        points: trackpoints,
        direction: cardinalDirection(first, last),
        ...stats,
      },
    ];
  }

  // Match each waypoint to nearest trackpoint index
  const waypointIndices: { index: number; name: string }[] = [];
  for (const wpt of waypoints) {
    let minDist = Infinity;
    let minIdx = 0;
    for (let i = 0; i < trackpoints.length; i++) {
      const d =
        Math.abs(trackpoints[i].lat - wpt.lat) +
        Math.abs(trackpoints[i].lon - wpt.lon);
      if (d < minDist) {
        minDist = d;
        minIdx = i;
      }
    }
    waypointIndices.push({ index: minIdx, name: wpt.name });
  }

  // Sort by index along route
  waypointIndices.sort((a, b) => a.index - b.index);

  // Build segment boundaries
  const boundaries: { start: number; end: number; name: string }[] = [];
  let prevIdx = 0;
  for (const wp of waypointIndices) {
    boundaries.push({
      start: prevIdx,
      end: wp.index,
      name: `To ${wp.name}`,
    });
    prevIdx = wp.index;
  }
  // Final segment from last waypoint to end
  if (prevIdx < trackpoints.length - 1) {
    boundaries.push({
      start: prevIdx,
      end: trackpoints.length - 1,
      name: `After ${waypointIndices[waypointIndices.length - 1].name}`,
    });
  }

  return boundaries.map((b) => {
    const segPoints = trackpoints.slice(b.start, b.end + 1);
    const stats = analyzePoints(segPoints);
    const first = segPoints[0];
    const last = segPoints[segPoints.length - 1];
    return {
      name: b.name,
      points: segPoints,
      direction: cardinalDirection(first, last),
      ...stats,
    };
  });
}

function analyzeRoute(
  name: string,
  trackpoints: Trackpoint[],
  waypoints: Waypoint[]
): RouteAnalysis {
  const segments = buildSegments(trackpoints, waypoints);
  const totalStats = analyzePoints(trackpoints);
  const smoothedEle = smoothElevations(trackpoints);
  const notableClimbs = findNotableClimbs(trackpoints, smoothedEle);

  // Try to name climbs using nearby waypoints
  for (const climb of notableClimbs) {
    let cumulDist = 0;
    let climbMidIdx = 0;
    const targetKm = climb.startKm + climb.lengthKm / 2;
    for (let i = 1; i < trackpoints.length; i++) {
      cumulDist += haversine(trackpoints[i - 1], trackpoints[i]);
      if (cumulDist >= targetKm) {
        climbMidIdx = i;
        break;
      }
    }
    // Find nearest waypoint within 5km
    for (const wpt of waypoints) {
      const d = haversine(trackpoints[climbMidIdx], {
        lat: wpt.lat,
        lon: wpt.lon,
        ele: 0,
      });
      if (d < 5) {
        climb.name = wpt.name;
        break;
      }
    }
  }

  return {
    name,
    totalDistance: totalStats.distance,
    totalElevationGain: totalStats.elevationGain,
    totalElevationLoss: totalStats.elevationLoss,
    maxAltitude: totalStats.maxAltitude,
    minAltitude: totalStats.minAltitude,
    startPoint: {
      lat: trackpoints[0].lat,
      lon: trackpoints[0].lon,
      ele: trackpoints[0].ele,
    },
    endPoint: {
      lat: trackpoints[trackpoints.length - 1].lat,
      lon: trackpoints[trackpoints.length - 1].lon,
      ele: trackpoints[trackpoints.length - 1].ele,
    },
    segments: segments.map(({ points, ...rest }) => ({
      ...rest,
      points: [],
    })) as Segment[],
    notableClimbs,
  };
}

// ─── Ollama LLM Integration ─────────────────────────────────────────────────

async function generateContent(
  analysis: RouteAnalysis,
  model: string
): Promise<LLMOutput> {
  const ollamaHost =
    process.env.OLLAMA_HOST || "http://localhost:11434";

  const systemPrompt = `You are a cycling content writer for a charity cycling challenge website called "Riding for GBS" (Guillain-Barré Syndrome). The riders are tackling an epic multi-day route through challenging terrain to raise awareness and funds.

Your task: Given structured route analysis data, generate evocative, inspiring cycling copy. Write in a tone that is adventurous, warm, and accessible — not overly technical. Convey the physical challenge while highlighting the beauty of the landscape.

IMPORTANT: Respond with ONLY valid JSON, no markdown fences, no explanation. Use this exact structure:
{
  "overview": "2-3 sentence overview of the full route",
  "segments": [
    {
      "name": "Segment name from data",
      "title": "Short evocative title (3-6 words)",
      "direction": "Cardinal direction from data",
      "distance": "Distance formatted with unit",
      "elevationGain": "Elevation gain formatted with unit",
      "terrain": "Brief terrain character description (1 sentence)",
      "narrative": "2-4 sentence narrative paragraph about this segment"
    }
  ],
  "notableClimbs": "1-2 sentence summary of the most significant climbs"
}`;

  // Build a clean stats summary for the LLM (no raw trackpoints)
  const statsForLlm = {
    name: analysis.name,
    totalDistance: `${analysis.totalDistance.toFixed(1)} km`,
    totalElevationGain: `${Math.round(analysis.totalElevationGain)} m`,
    totalElevationLoss: `${Math.round(analysis.totalElevationLoss)} m`,
    maxAltitude: `${Math.round(analysis.maxAltitude)} m`,
    minAltitude: `${Math.round(analysis.minAltitude)} m`,
    startElevation: `${Math.round(analysis.startPoint.ele)} m`,
    endElevation: `${Math.round(analysis.endPoint.ele)} m`,
    segments: analysis.segments.map((s) => ({
      name: s.name,
      distance: `${s.distance.toFixed(1)} km`,
      elevationGain: `${Math.round(s.elevationGain)} m`,
      elevationLoss: `${Math.round(s.elevationLoss)} m`,
      maxAltitude: `${Math.round(s.maxAltitude)} m`,
      minAltitude: `${Math.round(s.minAltitude)} m`,
      direction: s.direction,
      maxGradient: `${s.maxGradient.toFixed(1)}%`,
      avgGradient: `${s.avgGradient.toFixed(1)}%`,
    })),
    notableClimbs: analysis.notableClimbs.map((c) => ({
      name: c.name || "Unnamed climb",
      startKm: `${c.startKm} km`,
      lengthKm: `${c.lengthKm} km`,
      avgGradient: `${c.avgGradient}%`,
      elevationGain: `${c.elevationGain} m`,
    })),
  };

  const userPrompt = `Generate cycling content for this route:\n\n${JSON.stringify(statsForLlm, null, 2)}`;

  console.log(`\n🤖 Calling Ollama (${model})...`);

  const response = await fetch(`${ollamaHost}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 2048,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama API error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    message: { content: string };
  };
  let content = data.message.content.trim();

  // Strip markdown code fences if present
  if (content.startsWith("```")) {
    content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  // Some models (qwen3) include <think>...</think> blocks — strip them
  content = content.replace(/<think>[\s\S]*?<\/think>\s*/g, "");

  try {
    return JSON.parse(content) as LLMOutput;
  } catch {
    console.error("Failed to parse LLM response as JSON. Raw output:");
    console.error(content);
    throw new Error("LLM returned invalid JSON");
  }
}

// ─── Output Formatting ──────────────────────────────────────────────────────

function formatMarkdown(analysis: RouteAnalysis, llm?: LLMOutput): string {
  const lines: string[] = [];

  lines.push(`# ${analysis.name}`);
  lines.push("");

  if (llm) {
    lines.push(llm.overview);
    lines.push("");
  }

  lines.push("## Route Statistics");
  lines.push("");
  lines.push(`| Stat | Value |`);
  lines.push(`|------|-------|`);
  lines.push(`| Distance | ${analysis.totalDistance.toFixed(1)} km |`);
  lines.push(
    `| Elevation Gain | ${Math.round(analysis.totalElevationGain)} m |`
  );
  lines.push(
    `| Elevation Loss | ${Math.round(analysis.totalElevationLoss)} m |`
  );
  lines.push(`| Max Altitude | ${Math.round(analysis.maxAltitude)} m |`);
  lines.push(`| Min Altitude | ${Math.round(analysis.minAltitude)} m |`);
  lines.push(
    `| Start Elevation | ${Math.round(analysis.startPoint.ele)} m |`
  );
  lines.push(`| End Elevation | ${Math.round(analysis.endPoint.ele)} m |`);
  lines.push("");

  lines.push("## Segments");
  lines.push("");

  for (let i = 0; i < analysis.segments.length; i++) {
    const seg = analysis.segments[i];
    const llmSeg = llm?.segments?.[i];

    lines.push(`### ${i + 1}. ${llmSeg?.title || seg.name}`);
    lines.push("");

    if (llmSeg?.narrative) {
      lines.push(llmSeg.narrative);
      lines.push("");
    }

    lines.push(`- **Direction**: ${seg.direction}`);
    lines.push(`- **Distance**: ${seg.distance.toFixed(1)} km`);
    lines.push(`- **Elevation Gain**: ${Math.round(seg.elevationGain)} m`);
    lines.push(`- **Max Gradient**: ${seg.maxGradient.toFixed(1)}%`);
    if (llmSeg?.terrain) {
      lines.push(`- **Terrain**: ${llmSeg.terrain}`);
    }
    lines.push("");
  }

  if (analysis.notableClimbs.length > 0) {
    lines.push("## Notable Climbs");
    lines.push("");

    if (llm?.notableClimbs) {
      lines.push(llm.notableClimbs);
      lines.push("");
    }

    lines.push(`| Climb | Start | Length | Avg Gradient | Gain |`);
    lines.push(`|-------|-------|--------|-------------|------|`);
    for (const c of analysis.notableClimbs) {
      lines.push(
        `| ${c.name || "—"} | ${c.startKm} km | ${c.lengthKm} km | ${c.avgGradient}% | ${c.elevationGain} m |`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatJson(analysis: RouteAnalysis, llm?: LLMOutput) {
  return {
    route: {
      name: analysis.name,
      totalDistance: `${analysis.totalDistance.toFixed(1)} km`,
      totalElevationGain: `${Math.round(analysis.totalElevationGain)} m`,
      totalElevationLoss: `${Math.round(analysis.totalElevationLoss)} m`,
      maxAltitude: `${Math.round(analysis.maxAltitude)} m`,
      minAltitude: `${Math.round(analysis.minAltitude)} m`,
      start: analysis.startPoint,
      end: analysis.endPoint,
    },
    segments: analysis.segments.map((seg, i) => {
      const llmSeg = llm?.segments?.[i];
      return {
        name: seg.name,
        title: llmSeg?.title || seg.name,
        direction: seg.direction,
        distance: `${seg.distance.toFixed(1)} km`,
        elevationGain: `${Math.round(seg.elevationGain)} m`,
        elevationLoss: `${Math.round(seg.elevationLoss)} m`,
        maxAltitude: `${Math.round(seg.maxAltitude)} m`,
        minAltitude: `${Math.round(seg.minAltitude)} m`,
        maxGradient: `${seg.maxGradient.toFixed(1)}%`,
        avgGradient: `${seg.avgGradient.toFixed(1)}%`,
        terrain: llmSeg?.terrain || null,
        narrative: llmSeg?.narrative || null,
      };
    }),
    notableClimbs: analysis.notableClimbs,
    llm: llm
      ? {
          overview: llm.overview,
          notableClimbsSummary: llm.notableClimbs,
        }
      : null,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { gpxPath, noLlm, model, outputDir } = parseArgs(process.argv);
  const resolvedPath = path.resolve(gpxPath);

  console.log(`📂 Parsing: ${resolvedPath}`);

  const { name, waypoints, trackpoints } = await parseGpx(resolvedPath);

  console.log(`   Route: ${name}`);
  console.log(`   Trackpoints: ${trackpoints.length}`);
  console.log(`   Waypoints: ${waypoints.length}`);

  if (trackpoints.length === 0) {
    console.error("No trackpoints found in GPX file.");
    process.exit(1);
  }

  const analysis = analyzeRoute(name, trackpoints, waypoints);

  console.log(`\n📊 Route Analysis:`);
  console.log(`   Distance: ${analysis.totalDistance.toFixed(1)} km`);
  console.log(
    `   Elevation Gain: ${Math.round(analysis.totalElevationGain)} m`
  );
  console.log(
    `   Elevation Loss: ${Math.round(analysis.totalElevationLoss)} m`
  );
  console.log(`   Max Altitude: ${Math.round(analysis.maxAltitude)} m`);
  console.log(`   Min Altitude: ${Math.round(analysis.minAltitude)} m`);
  console.log(`   Segments: ${analysis.segments.length}`);
  console.log(`   Notable Climbs: ${analysis.notableClimbs.length}`);

  for (const seg of analysis.segments) {
    console.log(
      `     • ${seg.name}: ${seg.distance.toFixed(1)} km, ↑${Math.round(seg.elevationGain)}m, ${seg.direction}`
    );
  }

  // LLM content generation
  let llmOutput: LLMOutput | undefined;
  if (!noLlm) {
    try {
      llmOutput = await generateContent(analysis, model);
      console.log(`✅ LLM content generated`);
    } catch (err) {
      console.error(
        `\n⚠️  LLM generation failed: ${err instanceof Error ? err.message : err}`
      );
      console.log("   Continuing with stats-only output...");
    }
  } else {
    console.log("\n⏭️  Skipping LLM (--no-llm)");
  }

  // Write output files
  const baseName = path.basename(resolvedPath, ".gpx");
  const modelSlug = llmOutput ? `-${model.replace(/[^a-z0-9]+/gi, "-")}` : "";
  const outDir = outputDir
    ? path.resolve(outputDir)
    : path.dirname(resolvedPath);
  await fs.mkdir(outDir, { recursive: true });

  const mdPath = path.join(outDir, `${baseName}${modelSlug}.md`);
  const jsonPath = path.join(outDir, `${baseName}${modelSlug}.json`);

  const md = formatMarkdown(analysis, llmOutput);
  const json = formatJson(analysis, llmOutput);

  await fs.writeFile(mdPath, md, "utf-8");
  await fs.writeFile(jsonPath, JSON.stringify(json, null, 2), "utf-8");

  console.log(`\n📄 Output:`);
  console.log(`   ${mdPath}`);
  console.log(`   ${jsonPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
