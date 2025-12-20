// Developed by Alejandro Navarro Ayala - CEO & Senior Developer
import { IProducerRepository } from "../../../domain/repositories/IProducerRepository.js";
export class AddCertificationUseCase {
  constructor(private readonly producerRepository: IProducerRepository) {}
  async execute(dto: any): Promise<any> {
    return { id: 'dummy-cert-id' };
  }
}