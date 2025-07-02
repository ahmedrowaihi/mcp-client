export interface IMCPClient {
  connect(): Promise<any>;
  listTools(): Promise<any>;
  callTool(name: string, args: any): Promise<any>;
  close(): Promise<void>;
}
