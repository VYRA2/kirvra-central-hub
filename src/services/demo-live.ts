/**
 * Adaptador do modo demonstração para o contrato "ao vivo".
 *
 * Só é usado quando VITE_KIRVRA_DEMO_MODE === "true". Nunca é misturado com
 * dados reais: a origem é sempre marcada como "demo" e a faixa de
 * demonstração fica visível de forma permanente na interface.
 */
import type { LiveAlert, LiveSession } from "@/integrations/vyra/live";
import {
  alerts as mockAlerts,
  drivers as mockDrivers,
  sessions as mockSessions,
  vehicles as mockVehicles,
} from "@/mocks/kirvra-central";
import type { LiveContext } from "./vyra-live-service";

function driverName(driverId: string): string | null {
  return mockDrivers.find((driver) => driver.id === driverId)?.displayName ?? null;
}

export function buildDemoContext(): LiveContext {
  const sessions: LiveSession[] = mockSessions
    .filter((session) => session.state !== "encerrada")
    .map((session) => {
      const vehicle = mockVehicles.find((v) => v.id === session.vehicleId);
      return {
        id: session.id,
        driverId: session.driverId,
        vehicleId: session.vehicleId,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        state: session.state,
        riskLevel: session.riskLevel,
        lastHeartbeatAt: session.lastHeartbeatAt,
        point: {
          latitude: session.location.latitude,
          longitude: session.location.longitude,
        },
        address: session.location.address,
        accuracyMeters: session.location.accuracyMeters,
        sensors: {
          camera: session.sensors.camera,
          audio: session.sensors.audio,
          gps: session.sensors.gps,
          network: session.sensors.network,
        },
        driverName: driverName(session.driverId),
        vehicleLabel: vehicle ? `${vehicle.make} ${vehicle.model}` : null,
        plate: vehicle?.plate ?? null,
        alertIds: session.alertIds,
      };
    });

  const alerts: LiveAlert[] = mockAlerts.map((alert) => ({
    id: alert.id,
    protocol: alert.protocol,
    driverId: alert.driverId,
    sessionId: alert.sessionId,
    threatType: alert.threatType,
    confidence: alert.confidence,
    severity: alert.severity === "atencao" ? "atencao" : alert.severity,
    status: alert.state,
    detectedAt: alert.detectedAt,
    locationLabel: alert.locationLabel,
    driverName: driverName(alert.driverId),
  }));

  return { sessions, alerts, updatedAt: new Date().toISOString() };
}
