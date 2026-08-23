import type { Logger } from 'pino';
import type { BusEvent } from '../domain.js';
import type { ProductRepository } from '../repositories/productRepository.js';

type Consumer = (event: BusEvent) => Promise<void>;

export class MessageBusService {
  private readonly consumers = new Map<string, Consumer[]>();

  constructor(private readonly repository: ProductRepository, private readonly logger: Logger) {}

  subscribe(eventType: string, consumer: Consumer): void {
    const current = this.consumers.get(eventType) ?? [];
    current.push(consumer);
    this.consumers.set(eventType, current);
  }

  async publish(event: Omit<BusEvent, 'id'>): Promise<string> {
    return this.repository.publishBusEvent(event);
  }

  async processOnce(limit = 20): Promise<number> {
    const events = await this.repository.claimPendingBusEvents(limit);
    for (const event of events) {
      try {
        const consumers = [...(this.consumers.get(event.eventType) ?? []), ...(this.consumers.get('*') ?? [])];
        for (const consumer of consumers) await consumer(event);
        await this.repository.finishBusEvent(event.id, { status: 'processed' });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Message consumer failed';
        this.logger.error({ eventId: event.id, eventType: event.eventType, error: message }, 'Message bus consumer failed');
        await this.repository.finishBusEvent(event.id, { status: 'failed', error: message });
      }
    }
    return events.length;
  }
}
