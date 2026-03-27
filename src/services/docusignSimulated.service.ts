import { config } from '../config';
import { createMongoCircuit } from './circuit.service';
import { rootLogger } from '../utils/logger';

async function simulatedEnvelopeRequest(): Promise<void> {
  await new Promise((r) => setTimeout(r, 10 + Math.random() * 40));
  if (Math.random() < config.DOCUSIGN_SIM_FAILURE_RATE) {
    throw new Error('DocuSign simulé : service temporairement indisponible');
  }
}

export const docusignSimulatedBreaker = createMongoCircuit(
  'docusign-simulated',
  simulatedEnvelopeRequest,
  rootLogger,
);

/** Appel externe factice (signature électronique) protégé par circuit breaker. */
export async function verifySimulatedDocuSignEnvelope(): Promise<void> {
  await docusignSimulatedBreaker.fire();
}

export async function shutdownDocuSignCircuit(): Promise<void> {
  await docusignSimulatedBreaker.shutdown();
}
