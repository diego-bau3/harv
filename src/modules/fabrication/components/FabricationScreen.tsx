import {
  Activity,
  ArrowLeft,
  Clock3,
  Factory,
  Gauge,
  Play,
  Plus,
  Printer,
  Radio,
  Search
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import type { Product, ProductComponent, ProductUnit } from "../../sales/types";
import { createId, todayIso } from "../../sales/utils";
import { initialFabricationJobs, initialFabricationMachines } from "../data";
import type {
  FabricationConnectionType,
  FabricationJob,
  FabricationJobDraft,
  FabricationJobStatus,
  FabricationMachine,
  FabricationMachineDraft,
  FabricationMachineStatus
} from "../types";
import {
  calculateFabricationStats,
  clampProgress,
  fabricationConnectionLabels,
  fabricationControlModeLabels,
  fabricationJobStatusLabels,
  fabricationMachineStatusLabels,
  fabricationMachineTypeLabels,
  fabricationPriorityLabels,
  formatMinutes,
  getConnectionSignal,
  getMachineLabel,
  isManualMachine,
  jobMatches,
  machineMatches,
  recommendMachine
} from "../utils";

type FabricationScreenProps = {
  products: Product[];
  onBack: () => void;
};

type PrintableComponentOption = {
  id: string;
  productName: string;
  productSku: string;
  component: ProductComponent;
};

const machinesStorageKey = "harv:fabrication-machines:v1";
const jobsStorageKey = "harv:fabrication-jobs:v1";

function nowIso() {
  return new Date().toISOString();
}

function createEmptyMachineDraft(): FabricationMachineDraft {
  return {
    name: "",
    type: "impresora-3d",
    brand: "Bambu Lab",
    model: "P1S",
    location: "Celda 3D",
    connectionType: "manual",
    agentMachineId: "",
    ipAddress: "",
    status: "disponible",
    loadedMaterial: "PETG",
    supportedMaterials: "PLA, PETG",
    nozzleSize: 0.4,
    buildVolume: "256 x 256 x 256 mm",
    currentJobName: "",
    progress: 0,
    nozzleTemp: 28,
    bedTemp: 30,
    remainingMinutes: 0,
    lastSeenAt: nowIso(),
    notes: ""
  };
}

function createEmptyJobDraft(): FabricationJobDraft {
  return {
    partName: "",
    productName: "",
    componentId: "",
    quantity: 1,
    unit: "pieza",
    material: "PETG",
    priority: "normal",
    requiredDate: "",
    estimatedHours: 1,
    assignedMachineId: "",
    status: "pendiente",
    fileName: "",
    notes: ""
  };
}

function normalizeMachine(machine: Partial<FabricationMachine>): FabricationMachine {
  return {
    ...createEmptyMachineDraft(),
    ...machine,
    id: machine.id ?? createId("machine"),
    name: machine.name ?? "",
    brand: machine.brand ?? "",
    model: machine.model ?? "",
    location: machine.location ?? "",
    agentMachineId: machine.agentMachineId ?? "",
    ipAddress: machine.ipAddress ?? "",
    loadedMaterial: machine.loadedMaterial ?? "",
    supportedMaterials: machine.supportedMaterials ?? "",
    nozzleSize: Number(machine.nozzleSize ?? 0.4),
    progress: clampProgress(Number(machine.progress ?? 0)),
    nozzleTemp: Number(machine.nozzleTemp ?? 0),
    bedTemp: Number(machine.bedTemp ?? 0),
    remainingMinutes: Number(machine.remainingMinutes ?? 0),
    lastSeenAt: machine.lastSeenAt || nowIso(),
    notes: machine.notes ?? ""
  };
}

function normalizeJob(job: Partial<FabricationJob>): FabricationJob {
  return {
    ...createEmptyJobDraft(),
    ...job,
    id: job.id ?? createId("fab-job"),
    createdAt: job.createdAt ?? todayIso(),
    partName: job.partName ?? "",
    productName: job.productName ?? "",
    componentId: job.componentId ?? "",
    quantity: Number(job.quantity ?? 1),
    estimatedHours: Number(job.estimatedHours ?? 0),
    assignedMachineId: job.assignedMachineId ?? "",
    fileName: job.fileName ?? "",
    notes: job.notes ?? ""
  };
}

function loadStoredMachines() {
  try {
    const storedMachines = window.localStorage.getItem(machinesStorageKey);
    const machines = storedMachines ? JSON.parse(storedMachines) : initialFabricationMachines;

    return Array.isArray(machines) ? machines.map(normalizeMachine) : initialFabricationMachines.map(normalizeMachine);
  } catch {
    return initialFabricationMachines.map(normalizeMachine);
  }
}

function loadStoredJobs() {
  try {
    const storedJobs = window.localStorage.getItem(jobsStorageKey);
    const jobs = storedJobs ? JSON.parse(storedJobs) : initialFabricationJobs;

    return Array.isArray(jobs) ? jobs.map(normalizeJob) : initialFabricationJobs.map(normalizeJob);
  } catch {
    return initialFabricationJobs.map(normalizeJob);
  }
}

function saveStoredMachines(machines: FabricationMachine[]) {
  try {
    window.localStorage.setItem(machinesStorageKey, JSON.stringify(machines));
  } catch {
    return;
  }
}

function saveStoredJobs(jobs: FabricationJob[]) {
  try {
    window.localStorage.setItem(jobsStorageKey, JSON.stringify(jobs));
  } catch {
    return;
  }
}

export function FabricationScreen({ products, onBack }: FabricationScreenProps) {
  const [machines, setMachines] = useState<FabricationMachine[]>(loadStoredMachines);
  const [jobs, setJobs] = useState<FabricationJob[]>(loadStoredJobs);
  const [machineDraft, setMachineDraft] = useState<FabricationMachineDraft>(createEmptyMachineDraft);
  const [jobDraft, setJobDraft] = useState<FabricationJobDraft>(createEmptyJobDraft);
  const [selectedComponentId, setSelectedComponentId] = useState("manual");
  const [machineQuery, setMachineQuery] = useState("");
  const [jobQuery, setJobQuery] = useState("");
  const [machineError, setMachineError] = useState("");
  const [jobError, setJobError] = useState("");

  useEffect(() => {
    saveStoredMachines(machines);
  }, [machines]);

  useEffect(() => {
    saveStoredJobs(jobs);
  }, [jobs]);

  const printableComponents = useMemo<PrintableComponentOption[]>(() => {
    return products.flatMap((product) =>
      product.components
        .filter((component) => component.process === "impresion-3d")
        .map((component) => ({
          id: `${product.id}-${component.id}`,
          productName: product.name,
          productSku: product.sku,
          component
        }))
    );
  }, [products]);

  const filteredMachines = useMemo(() => {
    return machines.filter((machine) => machineMatches(machine, machineQuery));
  }, [machines, machineQuery]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => jobMatches(job, jobQuery, machines));
  }, [jobs, jobQuery, machines]);

  const stats = useMemo(() => calculateFabricationStats(machines, jobs), [machines, jobs]);
  const suggestedMachine = useMemo(() => recommendMachine(jobDraft, machines), [jobDraft, machines]);

  function updateMachineDraft<Key extends keyof FabricationMachineDraft>(
    key: Key,
    value: FabricationMachineDraft[Key]
  ) {
    setMachineDraft((currentDraft) => {
      if (key === "connectionType") {
        const connectionType = value as FabricationConnectionType;

        return {
          ...currentDraft,
          connectionType,
          status: connectionType === "bambu-lan" ? "offline" : "disponible",
          progress: 0,
          currentJobName: "",
          remainingMinutes: 0
        };
      }

      return { ...currentDraft, [key]: value };
    });
  }

  function updateJobDraft<Key extends keyof FabricationJobDraft>(key: Key, value: FabricationJobDraft[Key]) {
    setJobDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
  }

  function handleMachineSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!machineDraft.name.trim()) {
      setMachineError("Captura el nombre de la maquina.");
      return;
    }

    if (machineDraft.connectionType === "bambu-lan" && !machineDraft.agentMachineId.trim()) {
      setMachineError("Captura el ID de la maquina en el agente local.");
      return;
    }

    const isManualDraft = isManualMachine(machineDraft);

    const savedMachine: FabricationMachine = {
      ...machineDraft,
      id: createId("machine"),
      name: machineDraft.name.trim(),
      brand: machineDraft.brand.trim(),
      model: machineDraft.model.trim(),
      location: machineDraft.location.trim(),
      agentMachineId: machineDraft.agentMachineId.trim(),
      ipAddress: machineDraft.ipAddress.trim(),
      loadedMaterial: machineDraft.loadedMaterial.trim(),
      supportedMaterials: machineDraft.supportedMaterials.trim(),
      status: isManualDraft ? machineDraft.status : machineDraft.connectionType === "mock-agent" ? "disponible" : "offline",
      progress: isManualDraft ? clampProgress(machineDraft.progress) : 0,
      currentJobName: isManualDraft ? machineDraft.currentJobName.trim() : "",
      remainingMinutes: isManualDraft ? machineDraft.remainingMinutes : 0,
      lastSeenAt: nowIso(),
      notes: machineDraft.notes.trim()
    };

    setMachines((currentMachines) => [savedMachine, ...currentMachines]);
    setMachineDraft(createEmptyMachineDraft());
    setMachineError("");
  }

  function updateMachine(machineId: string, patch: Partial<FabricationMachine>) {
    setMachines((currentMachines) =>
      currentMachines.map((machine) =>
        machine.id === machineId
          ? {
              ...machine,
              ...patch,
              progress: patch.progress === undefined ? machine.progress : clampProgress(Number(patch.progress)),
              lastSeenAt: nowIso()
            }
          : machine
      )
    );
  }

  function updateMachineStatus(machineId: string, status: FabricationMachineStatus) {
    setMachines((currentMachines) =>
      currentMachines.map((machine) => {
        if (machine.id !== machineId) {
          return machine;
        }

        if (!isManualMachine(machine)) {
          return machine;
        }

        return {
          ...machine,
          status,
          progress: status === "disponible" ? 0 : machine.progress,
          currentJobName: status === "disponible" ? "" : machine.currentJobName,
          remainingMinutes: status === "disponible" ? 0 : machine.remainingMinutes,
          lastSeenAt: nowIso()
        };
      })
    );
  }

  function selectPrintableComponent(optionId: string) {
    setSelectedComponentId(optionId);

    if (optionId === "manual") {
      return;
    }

    const option = printableComponents.find((componentOption) => componentOption.id === optionId);

    if (!option) {
      return;
    }

    const printDesign = option.component.printDesigns[0];

    setJobDraft((currentDraft) => ({
      ...currentDraft,
      partName: option.component.name,
      productName: option.productName,
      componentId: option.component.id,
      quantity: option.component.quantity || currentDraft.quantity,
      unit: option.component.unit,
      material: option.component.material || currentDraft.material,
      fileName: printDesign?.fileName ?? "",
      notes: option.component.notes || currentDraft.notes
    }));
  }

  function applySuggestedMachine() {
    if (!suggestedMachine) {
      setJobError("No hay una maquina compatible disponible.");
      return;
    }

    setJobDraft((currentDraft) => ({
      ...currentDraft,
      assignedMachineId: suggestedMachine.id,
      status: "asignado"
    }));
    setJobError("");
  }

  function handleJobSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!jobDraft.partName.trim()) {
      setJobError("Captura la pieza o trabajo.");
      return;
    }

    if (jobDraft.quantity <= 0) {
      setJobError("La cantidad debe ser mayor a cero.");
      return;
    }

    const savedJob: FabricationJob = {
      ...jobDraft,
      id: createId("fab-job"),
      createdAt: todayIso(),
      partName: jobDraft.partName.trim(),
      productName: jobDraft.productName.trim(),
      material: jobDraft.material.trim(),
      estimatedHours: Number(jobDraft.estimatedHours),
      status: jobDraft.assignedMachineId ? "asignado" : jobDraft.status,
      fileName: jobDraft.fileName.trim(),
      notes: jobDraft.notes.trim()
    };

    setJobs((currentJobs) => [savedJob, ...currentJobs]);
    setJobDraft(createEmptyJobDraft());
    setSelectedComponentId("manual");
    setJobError("");
  }

  function updateJob(jobId: string, patch: Partial<FabricationJob>) {
    setJobs((currentJobs) => currentJobs.map((job) => (job.id === jobId ? { ...job, ...patch } : job)));
  }

  function refreshMockTelemetry() {
    setMachines((currentMachines) =>
      currentMachines.map((machine) => {
        if (machine.connectionType !== "mock-agent") {
          return {
            ...machine,
            lastSeenAt: nowIso()
          };
        }

        if (machine.status !== "imprimiendo") {
          return {
            ...machine,
            nozzleTemp: machine.status === "disponible" ? 28 : machine.nozzleTemp,
            bedTemp: machine.status === "disponible" ? 30 : machine.bedTemp,
            lastSeenAt: nowIso()
          };
        }

        const progress = clampProgress(machine.progress + 8);
        const isFinished = progress >= 100;

        return {
          ...machine,
          status: isFinished ? "disponible" : machine.status,
          progress: isFinished ? 0 : progress,
          currentJobName: isFinished ? "" : machine.currentJobName,
          remainingMinutes: isFinished ? 0 : Math.max(machine.remainingMinutes - 8, 0),
          nozzleTemp: isFinished ? 32 : machine.nozzleTemp,
          bedTemp: isFinished ? 34 : machine.bedTemp,
          lastSeenAt: nowIso()
        };
      })
    );
  }

  function startJob(job: FabricationJob) {
    const assignedMachine = machines.find((machine) => machine.id === job.assignedMachineId);

    if (!assignedMachine || assignedMachine.connectionType === "bambu-lan") {
      return;
    }

    updateJob(job.id, { status: "imprimiendo" });
    updateMachine(job.assignedMachineId, {
      status: "imprimiendo",
      currentJobName: job.partName,
      progress: 1,
      remainingMinutes: Math.max(Math.round(job.estimatedHours * 60), 15)
    });
  }

  function canStartJob(job: FabricationJob) {
    const assignedMachine = machines.find((machine) => machine.id === job.assignedMachineId);

    return Boolean(
      assignedMachine &&
        assignedMachine.connectionType !== "bambu-lan" &&
        job.status !== "imprimiendo" &&
        job.status !== "terminado"
    );
  }

  return (
    <main className="profile-screen fabrication-profile-screen">
      <header className="screen-header">
        <button className="icon-button" onClick={onBack} type="button" aria-label="Regresar a perfiles">
          <ArrowLeft size={22} />
        </button>
        <div className="screen-title">
          <span className="screen-icon fabrication-screen-icon" aria-hidden="true">
            <Factory size={22} />
          </span>
          <h1>Fabricacion</h1>
        </div>
      </header>

      <section className="fabrication-body">
        <section className="fabrication-command-panel">
          <div>
            <span className="section-kicker">Impresion 3D</span>
          </div>
          <div className="fabrication-command-actions">
            <button className="secondary-button" onClick={refreshMockTelemetry} type="button">
              <Radio size={17} />
              Actualizar estados
            </button>
          </div>
        </section>

        <section className="fabrication-stat-grid" aria-label="Resumen de fabricacion">
          <article>
            <Printer size={20} aria-hidden="true" />
            <span>Maquinas</span>
            <strong>{stats.machines}</strong>
          </article>
          <article>
            <Gauge size={20} aria-hidden="true" />
            <span>Disponibles</span>
            <strong>{stats.available}</strong>
          </article>
          <article>
            <Activity size={20} aria-hidden="true" />
            <span>Imprimiendo</span>
            <strong>{stats.printing}</strong>
          </article>
          <article>
            <Clock3 size={20} aria-hidden="true" />
            <span>Trabajos abiertos</span>
            <strong>{stats.pendingJobs}</strong>
          </article>
        </section>

        <div className="fabrication-layout">
          <section className="main-panel fabrication-machine-panel">
            <div className="clean-section-heading">
              <div>
                <h2>Maquinas</h2>
                <p>Registra impresoras y controla el estado operativo de cada una.</p>
              </div>
            </div>

            <form className="fabrication-machine-form" onSubmit={handleMachineSubmit}>
              <div className="form-grid two-columns">
                <label className="field">
                  <span>Nombre</span>
                  <input
                    value={machineDraft.name}
                    onChange={(event) => updateMachineDraft("name", event.target.value)}
                    placeholder="Ej. Bambu P1S 02"
                  />
                </label>

                <label className="field">
                  <span>Tipo</span>
                  <select
                    value={machineDraft.type}
                    onChange={(event) => updateMachineDraft("type", event.target.value as FabricationMachine["type"])}
                  >
                    {Object.entries(fabricationMachineTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Marca</span>
                  <input value={machineDraft.brand} onChange={(event) => updateMachineDraft("brand", event.target.value)} />
                </label>

                <label className="field">
                  <span>Modelo</span>
                  <input value={machineDraft.model} onChange={(event) => updateMachineDraft("model", event.target.value)} />
                </label>

                <label className="field">
                  <span>Ubicacion</span>
                  <input
                    value={machineDraft.location}
                    onChange={(event) => updateMachineDraft("location", event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Conexion</span>
                  <select
                    value={machineDraft.connectionType}
                    onChange={(event) =>
                      updateMachineDraft("connectionType", event.target.value as FabricationConnectionType)
                    }
                  >
                    {Object.entries(fabricationConnectionLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>ID agente</span>
                  <input
                    value={machineDraft.agentMachineId}
                    onChange={(event) => updateMachineDraft("agentMachineId", event.target.value)}
                    placeholder="Ej. bambu-p1s-02"
                  />
                </label>

                <label className="field">
                  <span>IP local</span>
                  <input
                    value={machineDraft.ipAddress}
                    onChange={(event) => updateMachineDraft("ipAddress", event.target.value)}
                    placeholder="Ej. 192.168.1.45"
                  />
                </label>

                <label className="field">
                  <span>Material cargado</span>
                  <input
                    value={machineDraft.loadedMaterial}
                    onChange={(event) => updateMachineDraft("loadedMaterial", event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Materiales soportados</span>
                  <input
                    value={machineDraft.supportedMaterials}
                    onChange={(event) => updateMachineDraft("supportedMaterials", event.target.value)}
                    placeholder="PLA, PETG, ABS"
                  />
                </label>

                {isManualMachine(machineDraft) ? (
                  <>
                    <label className="field">
                      <span>Estado</span>
                      <select
                        value={machineDraft.status}
                        onChange={(event) =>
                          updateMachineDraft("status", event.target.value as FabricationMachineStatus)
                        }
                      >
                        {Object.entries(fabricationMachineStatusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>Progreso</span>
                      <input
                        min="0"
                        max="100"
                        type="number"
                        value={machineDraft.progress}
                        onChange={(event) => updateMachineDraft("progress", Number(event.target.value))}
                      />
                    </label>
                  </>
                ) : null}
              </div>

              {machineError ? <p className="form-error">{machineError}</p> : null}

              <button className="primary-button input-height-button" type="submit">
                <Plus size={17} />
                Agregar maquina
              </button>
            </form>

            <label className="search-field client-search">
              <Search size={18} aria-hidden="true" />
              <input
                value={machineQuery}
                onChange={(event) => setMachineQuery(event.target.value)}
                placeholder="Buscar maquina, material o ubicacion"
              />
            </label>

            <div className="fabrication-machine-list">
              {filteredMachines.map((machine) => (
                <article className="fabrication-machine-card" key={machine.id}>
                  <div className="fabrication-machine-card-header">
                    <div className="fabrication-machine-title">
                      <Printer size={18} aria-hidden="true" />
                      <div>
                        <strong>{machine.name}</strong>
                        <span>
                          {machine.brand} / {machine.model}
                        </span>
                      </div>
                    </div>
                    <span className={`status-pill ${machine.status}`}>{fabricationMachineStatusLabels[machine.status]}</span>
                  </div>

                  <div
                    className="fabrication-progress"
                    style={{ "--progress": `${machine.progress}%` } as CSSProperties}
                    aria-label={`Progreso ${machine.progress}%`}
                  >
                    <span />
                  </div>

                  <dl className="fabrication-machine-meta">
                    <div>
                      <dt>Material</dt>
                      <dd>{machine.loadedMaterial || "Sin material"}</dd>
                    </div>
                    <div>
                      <dt>Temp</dt>
                      <dd>
                        {machine.nozzleTemp}C / {machine.bedTemp}C
                      </dd>
                    </div>
                    <div>
                      <dt>Restante</dt>
                      <dd>{formatMinutes(machine.remainingMinutes)}</dd>
                    </div>
                    <div>
                      <dt>Conexion</dt>
                      <dd>{fabricationConnectionLabels[machine.connectionType]}</dd>
                    </div>
                    <div>
                      <dt>Control</dt>
                      <dd>{fabricationControlModeLabels[machine.connectionType]}</dd>
                    </div>
                    <div>
                      <dt>Senal</dt>
                      <dd>{getConnectionSignal(machine)}</dd>
                    </div>
                  </dl>

                  {machine.currentJobName ? <p className="fabrication-current-job">{machine.currentJobName}</p> : null}

                  {isManualMachine(machine) ? (
                    <div className="fabrication-card-controls">
                      <label className="field">
                        <span>Estado</span>
                        <select
                          value={machine.status}
                          onChange={(event) =>
                            updateMachineStatus(machine.id, event.target.value as FabricationMachineStatus)
                          }
                        >
                          {Object.entries(fabricationMachineStatusLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Progreso</span>
                        <input
                          min="0"
                          max="100"
                          type="number"
                          value={machine.progress}
                          onChange={(event) => updateMachine(machine.id, { progress: Number(event.target.value) })}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="fabrication-telemetry-strip">
                      <div>
                        <span>Estado</span>
                        <strong>{fabricationMachineStatusLabels[machine.status]}</strong>
                      </div>
                      <div>
                        <span>Progreso</span>
                        <strong>{machine.progress}%</strong>
                      </div>
                    </div>
                  )}
                </article>
              ))}

              {machines.length === 0 ? <p className="empty-state">Todavia no hay maquinas registradas.</p> : null}
              {machines.length > 0 && filteredMachines.length === 0 ? (
                <p className="empty-state">No hay maquinas con esa busqueda.</p>
              ) : null}
            </div>
          </section>

          <section className="main-panel fabrication-queue-panel">
            <div className="clean-section-heading">
              <div>
                <h2>Cola de fabricacion</h2>
                <p>Piezas pendientes, prioridad, material y maquina sugerida.</p>
              </div>
            </div>

            <form className="fabrication-job-form" onSubmit={handleJobSubmit}>
              <label className="field wide-field">
                <span>Usar pieza 3D de productos</span>
                <select value={selectedComponentId} onChange={(event) => selectPrintableComponent(event.target.value)}>
                  <option value="manual">Captura manual</option>
                  {printableComponents.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.component.name} / {option.productName || option.productSku}
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-grid two-columns">
                <label className="field">
                  <span>Pieza o trabajo</span>
                  <input
                    value={jobDraft.partName}
                    onChange={(event) => updateJobDraft("partName", event.target.value)}
                    placeholder="Ej. Base de motor"
                  />
                </label>

                <label className="field">
                  <span>Material</span>
                  <input value={jobDraft.material} onChange={(event) => updateJobDraft("material", event.target.value)} />
                </label>

                <label className="field">
                  <span>Cantidad</span>
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={jobDraft.quantity}
                    onChange={(event) => updateJobDraft("quantity", Number(event.target.value))}
                  />
                </label>

                <label className="field">
                  <span>Unidad</span>
                  <select value={jobDraft.unit} onChange={(event) => updateJobDraft("unit", event.target.value as ProductUnit)}>
                    <option value="pieza">Pieza</option>
                    <option value="metro">Metro</option>
                    <option value="kg">Kg</option>
                    <option value="set">Set</option>
                  </select>
                </label>

                <label className="field">
                  <span>Prioridad</span>
                  <select
                    value={jobDraft.priority}
                    onChange={(event) => updateJobDraft("priority", event.target.value as FabricationJob["priority"])}
                  >
                    {Object.entries(fabricationPriorityLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Fecha requerida</span>
                  <input
                    type="date"
                    value={jobDraft.requiredDate}
                    onChange={(event) => updateJobDraft("requiredDate", event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Horas estimadas</span>
                  <input
                    min="0"
                    step="0.25"
                    type="number"
                    value={jobDraft.estimatedHours}
                    onChange={(event) => updateJobDraft("estimatedHours", Number(event.target.value))}
                  />
                </label>

                <label className="field">
                  <span>Maquina</span>
                  <select
                    value={jobDraft.assignedMachineId}
                    onChange={(event) => updateJobDraft("assignedMachineId", event.target.value)}
                  >
                    <option value="">Sin asignar</option>
                    {machines.map((machine) => (
                      <option key={machine.id} value={machine.id}>
                        {machine.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {suggestedMachine ? (
                <div className="fabrication-suggestion">
                  <Printer size={16} aria-hidden="true" />
                  <span>{suggestedMachine.name}</span>
                  <button className="secondary-button compact-button" onClick={applySuggestedMachine} type="button">
                    Usar sugerida
                  </button>
                </div>
              ) : null}

              <label className="field wide-field">
                <span>Archivo 3MF/STL</span>
                <input
                  value={jobDraft.fileName}
                  onChange={(event) => updateJobDraft("fileName", event.target.value)}
                  placeholder="Ej. SO101_BASE_MOTOR_P1S.3mf"
                />
              </label>

              <label className="field wide-field">
                <span>Notas</span>
                <textarea
                  value={jobDraft.notes}
                  onChange={(event) => updateJobDraft("notes", event.target.value)}
                  placeholder="Indicaciones, color, restricciones o revision pendiente"
                />
              </label>

              {jobError ? <p className="form-error">{jobError}</p> : null}

              <button className="primary-button input-height-button" type="submit">
                <Plus size={17} />
                Agregar trabajo
              </button>
            </form>

            <label className="search-field client-search">
              <Search size={18} aria-hidden="true" />
              <input
                value={jobQuery}
                onChange={(event) => setJobQuery(event.target.value)}
                placeholder="Buscar pieza, material o maquina"
              />
            </label>

            <div className="fabrication-job-list">
              {filteredJobs.map((job) => (
                <article className="fabrication-job-row" key={job.id}>
                  <div className="fabrication-job-main">
                    <strong>{job.partName}</strong>
                    <span>{job.productName || job.fileName || "Captura manual"}</span>
                  </div>

                  <div className="fabrication-job-stat">
                    <span>Cantidad</span>
                    <strong>
                      {job.quantity} {job.unit}
                    </strong>
                  </div>

                  <div className="fabrication-job-stat">
                    <span>Material</span>
                    <strong>{job.material || "Sin material"}</strong>
                  </div>

                  <div className="fabrication-job-stat">
                    <span>Maquina</span>
                    <strong>{getMachineLabel(job.assignedMachineId, machines)}</strong>
                  </div>

                  <span className={`status-pill ${job.status}`}>{fabricationJobStatusLabels[job.status]}</span>

                  <div className="fabrication-job-actions">
                    <select
                      value={job.status}
                      onChange={(event) => updateJob(job.id, { status: event.target.value as FabricationJobStatus })}
                      aria-label="Cambiar estado de trabajo"
                    >
                      {Object.entries(fabricationJobStatusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="secondary-button compact-button"
                      disabled={!canStartJob(job)}
                      onClick={() => startJob(job)}
                      type="button"
                    >
                      <Play size={15} />
                      Iniciar
                    </button>
                  </div>
                </article>
              ))}

              {jobs.length === 0 ? <p className="empty-state">Todavia no hay trabajos en cola.</p> : null}
              {jobs.length > 0 && filteredJobs.length === 0 ? (
                <p className="empty-state">No hay trabajos con esa busqueda.</p>
              ) : null}
            </div>
          </section>
        </div>

      </section>
    </main>
  );
}
