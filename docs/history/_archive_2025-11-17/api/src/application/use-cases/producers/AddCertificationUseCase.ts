export class AddCertificationUseCase {
  async execute(dto: any): Promise<any> {
    console.log(dto);
    return { certificationId: 'mock_cert_id' };
  }
}
