import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import mqtt from "mqtt";

const mqttDisabled = process.env.HARV_AGENT_DISABLE_MQTT === "1";
const defaultDataDir = process.env.APPDATA
  ? path.join(process.env.APPDATA, "Harv", "agent")
  : path.join(os.homedir(), ".harv-agent");
const dataDir = process.env.HARV_AGENT_DATA_DIR || defaultDataDir;
const printersFile = path.join(dataDir, "printers.json");

const clients = new Map();
const printerStates = new Map();

function nowIso() {
  return new Date().toISOString();
}

function createId(value) {
  return `bambu-${crypto.createHash("sha1").update(value).digest("hex").slice(0, 12)}`;
}

function cleanString(value) {
  return String(value ?? "").trim();
}

function isPrivateOrLocalIp(value) {
  return (
    /^127\./.test(value) ||
    /^10\./.test(value) ||
    /^192\.168\./.test(value) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(value)
  );
}

function createEmptyStatus(printer, patch = {}) {
  return {
    printerId: printer.id,
    connectionState: "offline",
    status: "offline",
    loadedMaterial: "",
    materialSlots: [],
    currentJobName: "",
    progress: 0,
    remainingMinutes: 0,
    estimatedFinishAt: "",
    nozzleTemp: 0,
    bedTemp: 0,
    chamberTemp: 0,
    message: "",
    lastSeenAt: "",
    source: "mqtt",
    ...patch
  };
}

function setPrinterState(printer, patch) {
  const current = printerStates.get(printer.id) ?? createEmptyStatus(printer);
  const next = {
    ...current,
    ...patch,
    printerId: printer.id
  };

  printerStates.set(printer.id, next);
  return next;
}

function numberFrom(...values) {
  for (const value of values) {
    const numberValue = Number(value);

    if (Number.isFinite(numberValue)) {
      return numberValue;
    }
  }

  return 0;
}

function stringFrom(...values) {
  for (const value of values) {
    const stringValue = cleanString(value);

    if (stringValue) {
      return stringValue;
    }
  }

  return "";
}

function normalizeProgress(value) {
  const progress = numberFrom(value);

  return Math.min(Math.max(Math.round(progress), 0), 100);
}

function calculateFinishAt(remainingMinutes) {
  if (!remainingMinutes || remainingMinutes <= 0) {
    return "";
  }

  return new Date(Date.now() + remainingMinutes * 60_000).toISOString();
}

function normalizeColor(value) {
  const color = cleanString(value).replace(/^#/, "");

  if (!color || color.length < 6) {
    return "";
  }

  return `#${color.slice(0, 6)}`;
}

function collectMaterialSlots(print) {
  const slots = [];
  const amsGroups = Array.isArray(print.ams?.ams) ? print.ams.ams : [];

  for (const [amsIndex, ams] of amsGroups.entries()) {
    const trays = Array.isArray(ams?.tray) ? ams.tray : [];

    for (const [trayIndex, tray] of trays.entries()) {
      const material = stringFrom(tray?.tray_type, tray?.material, tray?.filament_type);
      const color = normalizeColor(tray?.tray_color);

      if (!material && !color) {
        continue;
      }

      slots.push({
        slot: `AMS ${amsIndex + 1}-${trayIndex + 1}`,
        material: material || "Sin tipo",
        color
      });
    }
  }

  if (print.vt_tray && typeof print.vt_tray === "object") {
    const material = stringFrom(print.vt_tray.tray_type, print.vt_tray.material, print.vt_tray.filament_type);
    const color = normalizeColor(print.vt_tray.tray_color);

    if (material || color) {
      slots.push({
        slot: "Actual",
        material: material || "Sin tipo",
        color
      });
    }
  }

  return slots;
}

function findActiveMaterial(print, materialSlots) {
  const directMaterial = stringFrom(
    print.filament_type,
    print.material,
    print.tray_type,
    print.vt_tray?.tray_type,
    print.vt_tray?.material,
    print.vt_tray?.filament_type
  );

  if (directMaterial) {
    return directMaterial;
  }

  const selectedTray = stringFrom(print.ams?.tray_now, print.tray_now, print.vt_tray?.id);

  if (selectedTray) {
    const matchingSlot = materialSlots.find((slot) => slot.slot.endsWith(`-${selectedTray}`));

    if (matchingSlot) {
      return matchingSlot.material;
    }
  }

  return Array.from(new Set(materialSlots.map((slot) => slot.material).filter(Boolean))).join(", ");
}

function mapBambuStatus(value) {
  const status = cleanString(value).toUpperCase();

  if (["RUNNING", "PRINTING", "PREPARE", "PREPARING", "SLICING"].includes(status)) {
    return "imprimiendo";
  }

  if (["PAUSE", "PAUSED", "SUSPEND"].includes(status)) {
    return "pausada";
  }

  if (["FAILED", "FAIL", "ERROR", "ABNORMAL"].includes(status)) {
    return "error";
  }

  if (["FINISH", "FINISHED", "COMPLETED", "COMPLETE", "IDLE", "READY"].includes(status)) {
    return "disponible";
  }

  return "";
}

function normalizeBambuReport(printer, report) {
  const print = report.print && typeof report.print === "object" ? report.print : report;
  const current = printerStates.get(printer.id) ?? createEmptyStatus(printer);
  const remainingMinutes = numberFrom(print.mc_remaining_time, print.remaining_time, print.remainingTime);
  const materialSlots = collectMaterialSlots(print);
  const loadedMaterial = findActiveMaterial(print, materialSlots);
  const status =
    mapBambuStatus(print.gcode_state) ||
    mapBambuStatus(print.print_status) ||
    mapBambuStatus(print.state) ||
    current.status ||
    "offline";

  return {
    connectionState: "connected",
    status,
    loadedMaterial: loadedMaterial || current.loadedMaterial,
    materialSlots: materialSlots.length > 0 ? materialSlots : current.materialSlots,
    currentJobName: stringFrom(print.subtask_name, print.gcode_file, print.task_name, current.currentJobName),
    progress: normalizeProgress(print.mc_percent ?? print.progress ?? print.print_percent ?? current.progress),
    remainingMinutes,
    estimatedFinishAt: calculateFinishAt(remainingMinutes),
    nozzleTemp: numberFrom(print.nozzle_temper, print.nozzle_temp, print.nozzle_temperature, current.nozzleTemp),
    bedTemp: numberFrom(print.bed_temper, print.bed_temp, print.bed_temperature, current.bedTemp),
    chamberTemp: numberFrom(print.chamber_temper, print.chamber_temp, current.chamberTemp),
    message: stringFrom(print.fail_reason, print.print_error, print.msg),
    lastSeenAt: nowIso(),
    source: "mqtt"
  };
}

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function readStoredPrinters() {
  try {
    const content = await fs.readFile(printersFile, "utf8");
    const parsed = JSON.parse(content);

    return Array.isArray(parsed.printers) ? parsed.printers : [];
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeStoredPrinters(printers) {
  await ensureDataDir();
  await fs.writeFile(printersFile, JSON.stringify({ printers }, null, 2), "utf8");
}

function redactPrinter(printer) {
  const { accessCode, ...safePrinter } = printer;

  return {
    ...safePrinter,
    hasAccessCode: Boolean(accessCode),
    status: printerStates.get(printer.id) ?? createEmptyStatus(printer)
  };
}

function disconnectPrinter(printerId) {
  const client = clients.get(printerId);

  if (!client) {
    return;
  }

  client.removeAllListeners();
  client.end(true);
  clients.delete(printerId);
}

function publishPushAll(printer, client) {
  const requestTopic = `device/${printer.serial}/request`;
  const payload = {
    pushing: {
      sequence_id: String(Date.now()),
      command: "pushall"
    }
  };

  client.publish(requestTopic, JSON.stringify(payload));
}

function connectLinkedPrinter(printer) {
  disconnectPrinter(printer.id);

  if (mqttDisabled) {
    setPrinterState(printer, {
      connectionState: "offline",
      status: "offline",
      message: "MQTT desactivado por configuracion local.",
      lastSeenAt: ""
    });
    return;
  }

  if (!printer.ipAddress || !printer.serial || !printer.accessCode) {
    setPrinterState(printer, {
      connectionState: "setup-required",
      status: "offline",
      message: "Falta IP, serial o access code.",
      lastSeenAt: ""
    });
    return;
  }

  const reportTopic = `device/${printer.serial}/report`;
  const client = mqtt.connect({
    protocol: "mqtts",
    host: printer.ipAddress,
    port: Number(printer.port ?? 8883),
    username: "bblp",
    password: printer.accessCode,
    clientId: `harv_${printer.serial}_${Date.now()}`,
    clean: true,
    connectTimeout: 8000,
    reconnectPeriod: 15000,
    protocolVersion: 4,
    rejectUnauthorized: false
  });

  clients.set(printer.id, client);
  setPrinterState(printer, {
    connectionState: "connecting",
    status: "offline",
    message: "Conectando a MQTT LAN..."
  });

  client.on("connect", () => {
    setPrinterState(printer, {
      connectionState: "connected",
      message: "MQTT LAN conectado.",
      lastSeenAt: nowIso()
    });
    client.subscribe(reportTopic);
    publishPushAll(printer, client);
  });

  client.on("message", (_topic, message) => {
    try {
      const report = JSON.parse(message.toString("utf8"));
      setPrinterState(printer, normalizeBambuReport(printer, report));
    } catch (error) {
      setPrinterState(printer, {
        connectionState: "connected",
        message: error instanceof Error ? `Reporte no valido: ${error.message}` : "Reporte no valido.",
        lastSeenAt: nowIso()
      });
    }
  });

  client.on("reconnect", () => {
    setPrinterState(printer, {
      connectionState: "connecting",
      status: "offline",
      message: "Reconectando a MQTT LAN..."
    });
  });

  client.on("offline", () => {
    setPrinterState(printer, {
      connectionState: "offline",
      status: "offline",
      message: "Impresora offline.",
      lastSeenAt: nowIso()
    });
  });

  client.on("close", () => {
    setPrinterState(printer, {
      connectionState: "offline",
      status: "offline",
      message: "Conexion cerrada.",
      lastSeenAt: nowIso()
    });
  });

  client.on("error", (error) => {
    setPrinterState(printer, {
      connectionState: "error",
      status: "offline",
      message: error instanceof Error ? error.message : "Error de conexion MQTT.",
      lastSeenAt: nowIso()
    });
  });
}

export async function startLinkedPrinterConnections() {
  const printers = await readStoredPrinters();

  for (const printer of printers) {
    connectLinkedPrinter(printer);
  }

  return printers.map(redactPrinter);
}

export async function listLinkedPrinters() {
  const printers = await readStoredPrinters();

  return printers.map(redactPrinter);
}

export async function linkPrinter(input) {
  const ipAddress = cleanString(input.ipAddress);
  const serial = cleanString(input.serial);
  const accessCode = cleanString(input.accessCode);

  if (!ipAddress || !isPrivateOrLocalIp(ipAddress)) {
    const error = new Error("Captura una IP local valida para la impresora.");
    error.status = 400;
    throw error;
  }

  if (!serial) {
    const error = new Error("Captura el serial de la impresora Bambu.");
    error.status = 400;
    throw error;
  }

  if (!accessCode) {
    const error = new Error("Captura el access code de Bambu LAN.");
    error.status = 400;
    throw error;
  }

  const printers = await readStoredPrinters();
  const existingPrinter = printers.find((printer) => printer.serial === serial || printer.ipAddress === ipAddress);
  const printer = {
    id: existingPrinter?.id ?? createId(`${serial}-${ipAddress}`),
    name: cleanString(input.name) || existingPrinter?.name || `Bambu ${ipAddress}`,
    brand: cleanString(input.brand) || "Bambu Lab",
    model: cleanString(input.model) || existingPrinter?.model || "",
    location: cleanString(input.location) || existingPrinter?.location || "Celda 3D",
    ipAddress,
    serial,
    accessCode,
    port: Number(input.port ?? existingPrinter?.port ?? 8883),
    linkedAt: existingPrinter?.linkedAt ?? nowIso(),
    updatedAt: nowIso()
  };
  const nextPrinters = existingPrinter
    ? printers.map((currentPrinter) => (currentPrinter.id === existingPrinter.id ? printer : currentPrinter))
    : [printer, ...printers];

  await writeStoredPrinters(nextPrinters);
  connectLinkedPrinter(printer);

  return redactPrinter(printer);
}
