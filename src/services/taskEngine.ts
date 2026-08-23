import type { Logger } from 'pino';
import type { ProductRepository } from '../repositories/productRepository.js';

export class TaskEngineService {
  constructor(private readonly repository: ProductRepository, private readonly logger: Logger) {}

  async start(input: { companyId: string; taskId: string; actorUserId: string }) {
    const ready = await this.repository.dependenciesComplete(input.companyId, input.taskId);
    if (!ready) {
      this.logger.warn({ taskId: input.taskId }, 'Task blocked by incomplete dependency');
      return this.repository.transitionTask({ ...input, status: 'blocked', blockedReason: 'One or more task dependencies are not complete' });
    }
    return this.repository.transitionTask({ ...input, status: 'in_progress' });
  }

  async retry(input: { companyId: string; taskId: string; actorUserId: string }) {
    return this.repository.retryTask(input);
  }

  async complete(input: { companyId: string; taskId: string; actorUserId: string; output?: unknown }) {
    return this.repository.transitionTask({ ...input, status: 'done', output: input.output });
  }

  async fail(input: { companyId: string; taskId: string; actorUserId: string; failureReason: string }) {
    return this.repository.transitionTask({ ...input, status: 'failed', failureReason: input.failureReason });
  }
}
