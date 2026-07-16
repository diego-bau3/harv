import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  HelpCircle,
  Monitor,
  PackageCheck,
  Play,
  RefreshCw,
  Wrench
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Product } from "../../sales/types";
import type { AssemblyProblemType, AssemblyStation, AssemblyStationStatus } from "../types";
import {
  assemblyProblemTypeLabels,
  assemblyStationStatusLabels,
  createAssemblyProblem,
  createAssemblyStationsFromPlan,
  currentAssemblyStep,
  loadLatestProductionPlanForAssembly,
  loadStoredAssemblyProblems,
  loadStoredAssemblyStations,
  saveStoredAssemblyProblems,
  saveStoredAssemblyStations,
  stationProgress
} from "../utils";

type AssemblyScreenProps = {
  products: Product[];
  onBack: () => void;
};

type AssemblyView = "tablero" | "estacion" | "problemas";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function AssemblyScreen({ products, onBack }: AssemblyScreenProps) {
  const [planSource, setPlanSource] = useState(() => loadLatestProductionPlanForAssembly(products));
  const [stations, setStations] = useState<AssemblyStation[]>(() => {
    const storedStations = loadStoredAssemblyStations();

    return storedStations.length > 0 ? storedStations : createAssemblyStationsFromPlan(planSource.plan, products);
  });
  const [problems, setProblems] = useState(() => loadStoredAssemblyProblems());
  const [activeView, setActiveView] = useState<AssemblyView>("tablero");
  const [selectedStationId, setSelectedStationId] = useState(stations[0]?.id ?? "");
  const [problemType, setProblemType] = useState<AssemblyProblemType>("falta-pieza");
  const [problemNotes, setProblemNotes] = useState("");

  const selectedStation = useMemo(
    () => stations.find((station) => station.id === selectedStationId) ?? stations[0],
    [selectedStationId, stations]
  );
  const activeProblems = problems.filter((problem) => problem.status === "abierto");
  const completedUnits = stations.reduce((total, station) => total + station.completedQuantity, 0);
  const assignedUnits = stations.reduce((total, station) => total + station.assignedQuantity, 0);

  useEffect(() => {
    saveStoredAssemblyStations(stations);
  }, [stations]);

  useEffect(() => {
    saveStoredAssemblyProblems(problems);
  }, [problems]);

  function refreshFromProduction() {
    const nextPlanSource = loadLatestProductionPlanForAssembly(products);
    const nextStations = createAssemblyStationsFromPlan(nextPlanSource.plan, products);

    setPlanSource(nextPlanSource);
    setStations(nextStations);
    setSelectedStationId(nextStations[0]?.id ?? "");
    setActiveView("tablero");
  }

  function updateStationStatus(stationId: string, status: AssemblyStationStatus) {
    setStations((currentStations) =>
      currentStations.map((station) =>
        station.id === stationId
          ? {
              ...station,
              status,
              lastUpdatedAt: new Date().toISOString()
            }
          : station
      )
    );
  }

  function completeCurrentStep(stationId: string) {
    setStations((currentStations) =>
      currentStations.map((station) => {
        if (station.id !== stationId) {
          return station;
        }

        const isLastStep = station.currentStepIndex >= station.steps.length - 1;
        const nextCompletedQuantity = isLastStep
          ? Math.min(station.completedQuantity + 1, station.assignedQuantity)
          : station.completedQuantity;
        const isStationFinished = nextCompletedQuantity >= station.assignedQuantity;

        return {
          ...station,
          status: isStationFinished ? "terminada" : "ensamblando",
          completedQuantity: nextCompletedQuantity,
          currentUnit: isLastStep ? Math.min(station.currentUnit + 1, station.assignedQuantity) : station.currentUnit,
          currentStepIndex: isStationFinished ? station.currentStepIndex : isLastStep ? 0 : station.currentStepIndex + 1,
          lastUpdatedAt: new Date().toISOString()
        };
      })
    );
  }

  function openStation(stationId: string) {
    setSelectedStationId(stationId);
    setActiveView("estacion");
  }

  function submitProblem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedStation) {
      return;
    }

    const nextProblem = createAssemblyProblem(selectedStation, problemType, problemNotes || "Operador solicita apoyo.");

    setProblems((currentProblems) => [nextProblem, ...currentProblems]);
    updateStationStatus(selectedStation.id, "bloqueada");
    setProblemNotes("");
    setActiveView("problemas");
  }

  function resolveProblem(problemId: string) {
    setProblems((currentProblems) =>
      currentProblems.map((problem) => (problem.id === problemId ? { ...problem, status: "resuelto" } : problem))
    );
  }

  return (
    <main className="assembly-profile-screen">
      <header className="screen-header">
        <button className="icon-button" onClick={onBack} type="button" aria-label="Regresar a perfiles">
          <ArrowLeft size={22} />
        </button>
        <div className="screen-title">
          <span className="screen-icon assembly-screen-icon" aria-hidden="true">
            <Monitor size={22} />
          </span>
          <h1>Ensamble</h1>
        </div>
      </header>

      <section className="assembly-body">
        <section className="assembly-command-panel">
          <div>
            <span className="section-kicker">Ejecución conectada a Producción</span>
            <h2>Tablero de estaciones</h2>
            <p>
              Cada estación recibe el bloque de ensamble del plan de Producción y lo convierte en instrucciones visuales
              para el operador.
            </p>
          </div>
          <div className="assembly-command-actions">
            <button className="secondary-button" onClick={refreshFromProduction} type="button">
              <RefreshCw size={18} />
              Actualizar desde Producción
            </button>
          </div>
        </section>

        <section className="assembly-summary-grid">
          <article>
            <Monitor size={18} />
            <span>Estaciones</span>
            <strong>{stations.length}</strong>
          </article>
          <article>
            <PackageCheck size={18} />
            <span>Avance</span>
            <strong>
              {completedUnits}/{assignedUnits}
            </strong>
          </article>
          <article>
            <AlertTriangle size={18} />
            <span>Problemas</span>
            <strong>{activeProblems.length}</strong>
          </article>
          <article>
            <ClipboardList size={18} />
            <span>Plan</span>
            <strong>{planSource.source.label}</strong>
          </article>
        </section>

        <nav className="assembly-tabs" aria-label="Vistas de ensamble">
          <button className={activeView === "tablero" ? "active" : ""} onClick={() => setActiveView("tablero")} type="button">
            Tablero
          </button>
          <button
            className={activeView === "estacion" ? "active" : ""}
            onClick={() => setActiveView("estacion")}
            type="button"
            disabled={!selectedStation}
          >
            Modo estación
          </button>
          <button
            className={activeView === "problemas" ? "active" : ""}
            onClick={() => setActiveView("problemas")}
            type="button"
          >
            Problemas
          </button>
        </nav>

        {activeView === "tablero" ? (
          <section className="assembly-station-grid">
            {stations.length === 0 ? (
              <div className="empty-state">No hay bloques de ensamble en el plan actual de Producción.</div>
            ) : (
              stations.map((station) => {
                const step = currentAssemblyStep(station);
                const progress = stationProgress(station);

                return (
                  <article className={`assembly-station-card status-${station.status}`} key={station.id}>
                    <header>
                      <div>
                        <span>{station.name}</span>
                        <h3>{station.productSku}</h3>
                      </div>
                      <span className={`status-pill status-${station.status}`}>{assemblyStationStatusLabels[station.status]}</span>
                    </header>
                    <p>{station.productName}</p>
                    <div className="assembly-station-meta">
                      <span>{station.sourceOrder}</span>
                      <span>{station.operatorName}</span>
                      <span>
                        {station.completedQuantity}/{station.assignedQuantity} equipos
                      </span>
                      <span>
                        {station.planStartTime} - {station.planEndTime}
                      </span>
                    </div>
                    <div className="assembly-progress-bar" aria-label={`Avance ${progress}%`}>
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <div className="assembly-current-step">
                      <strong>Paso {step?.sequence ?? 0}</strong>
                      <span>{step?.title ?? "Sin paso"}</span>
                    </div>
                    <button className="primary-button" onClick={() => openStation(station.id)} type="button">
                      Abrir estación
                    </button>
                  </article>
                );
              })
            )}
          </section>
        ) : null}

        {activeView === "estacion" && selectedStation ? (
          <section className="assembly-operator-layout">
            <OperatorPanel
              problemNotes={problemNotes}
              problemType={problemType}
              station={selectedStation}
              onCompleteStep={() => completeCurrentStep(selectedStation.id)}
              onProblemNotesChange={setProblemNotes}
              onProblemTypeChange={setProblemType}
              onStart={() => updateStationStatus(selectedStation.id, "ensamblando")}
              onSubmitProblem={submitProblem}
            />
          </section>
        ) : null}

        {activeView === "problemas" ? (
          <section className="assembly-problems-panel">
            <div className="clean-section-heading">
              <div>
                <span className="section-kicker">Bloqueos de estación</span>
                <h2>Problemas reportados</h2>
                <p>Estos reportes después se conectarán con Producción, Almacén, Calidad y Mejora continua.</p>
              </div>
            </div>
            <div className="assembly-problem-list">
              {problems.length === 0 ? (
                <div className="empty-state">Todavía no hay problemas reportados.</div>
              ) : (
                problems.map((problem) => (
                  <article className={`assembly-problem-card status-${problem.status}`} key={problem.id}>
                    <div>
                      <span>{assemblyProblemTypeLabels[problem.type]}</span>
                      <strong>{problem.stepTitle}</strong>
                      <p>{problem.notes}</p>
                    </div>
                    <div>
                      <span>{problem.stationName}</span>
                      <span>{problem.sourceOrder}</span>
                      <span>{formatDateTime(problem.createdAt)}</span>
                    </div>
                    {problem.status === "abierto" ? (
                      <button className="secondary-button compact-button" onClick={() => resolveProblem(problem.id)} type="button">
                        Resolver
                      </button>
                    ) : (
                      <span className="status-pill status-terminada">Resuelto</span>
                    )}
                  </article>
                ))
              )}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

type OperatorPanelProps = {
  station: AssemblyStation;
  problemType: AssemblyProblemType;
  problemNotes: string;
  onCompleteStep: () => void;
  onProblemNotesChange: (notes: string) => void;
  onProblemTypeChange: (type: AssemblyProblemType) => void;
  onStart: () => void;
  onSubmitProblem: (event: FormEvent<HTMLFormElement>) => void;
};

function OperatorPanel({
  problemNotes,
  problemType,
  station,
  onCompleteStep,
  onProblemNotesChange,
  onProblemTypeChange,
  onStart,
  onSubmitProblem
}: OperatorPanelProps) {
  const step = currentAssemblyStep(station);
  const progress = stationProgress(station);

  return (
    <>
      <section className="assembly-operator-main">
        <header>
          <div>
            <span>
              {station.name} · Unidad {Math.min(station.currentUnit, station.assignedQuantity)} de {station.assignedQuantity}
            </span>
            <h2>{step.title}</h2>
            <p>
              {station.productSku} · {station.sourceOrder}
            </p>
          </div>
          <strong>{step.targetMinutes} min objetivo</strong>
        </header>

        <AssemblyVisual visual={step.visual} />

        <div className="assembly-operator-actions">
          <button className="primary-button" onClick={onStart} type="button" disabled={station.status === "terminada"}>
            <Play size={20} />
            Iniciar
          </button>
          <button className="primary-button" onClick={onCompleteStep} type="button" disabled={station.status === "terminada"}>
            <CheckCircle2 size={20} />
            Terminar paso
          </button>
          <button className="secondary-button" onClick={() => onProblemTypeChange("falta-pieza")} type="button">
            <HelpCircle size={20} />
            Pedir ayuda
          </button>
        </div>

        <div className="assembly-progress-bar large" aria-label={`Avance ${progress}%`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </section>

      <aside className="assembly-operator-side">
        <section>
          <h3>Necesitas</h3>
          <ul>
            {step.components.map((component) => (
              <li key={component}>{component}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3>Herramientas</h3>
          <ul>
            {step.tools.map((tool) => (
              <li key={tool}>
                <Wrench size={15} />
                {tool}
              </li>
            ))}
          </ul>
        </section>

        {step.consumables.length > 0 ? (
          <section>
            <h3>Consumibles</h3>
            <ul>
              {step.consumables.map((consumable) => (
                <li key={consumable}>{consumable}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h3>Instrucciones</h3>
          <ol>
            {step.instructions.map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
          </ol>
        </section>

        <form className="assembly-problem-form" onSubmit={onSubmitProblem}>
          <h3>Reportar problema</h3>
          <label className="field">
            <span>Tipo</span>
            <select value={problemType} onChange={(event) => onProblemTypeChange(event.target.value as AssemblyProblemType)}>
              {Object.entries(assemblyProblemTypeLabels).map(([type, label]) => (
                <option key={type} value={type}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Notas</span>
            <textarea value={problemNotes} onChange={(event) => onProblemNotesChange(event.target.value)} />
          </label>
          <button className="secondary-button danger" type="submit">
            <AlertTriangle size={18} />
            Bloquear estación
          </button>
        </form>
      </aside>
    </>
  );
}

function AssemblyVisual({ visual }: { visual: AssemblyStation["steps"][number]["visual"] }) {
  return (
    <div className={`assembly-visual visual-${visual}`} aria-label="Diagrama visual de ensamble">
      <div className="assembly-visual-base" />
      <div className="assembly-visual-motor" />
      <div className="assembly-visual-gripper" />
      <div className="assembly-visual-screw screw-a" />
      <div className="assembly-visual-screw screw-b" />
      <span>{visual === "base" ? "Base" : visual === "motor" ? "Motor" : visual === "gripper" ? "Gripper" : "Calidad"}</span>
    </div>
  );
}
