import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import * as https from 'https';

export interface EngineTransactionOverrides {
  gas?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  timeoutSeconds?: string;
  value?: string;
}

export interface EngineAbiComponent {
  type: string;
  inputs?: Array<{ components?: unknown[] }>;
  outputs?: Array<{ components?: unknown[] }>;
}

export interface EngineWriteRequest {
  functionName: string;
  args: unknown[];
  txOverrides?: EngineTransactionOverrides;
  abi?: EngineAbiComponent[];
}

export interface EngineResponse {
  queueId: string;
  result?: unknown;
  error?: string;
}

@Injectable()
export class EngineUtil {
  private readonly logger = new Logger(EngineUtil.name);
  private readonly engineBaseUrl: string;
  private readonly backendWalletAddress: string;
  private readonly authToken: string;
  private readonly httpsAgent: https.Agent;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.engineBaseUrl =
      this.configService.get<string>('ENGINE_BASE_URL') || '';
    this.backendWalletAddress =
      this.configService.get<string>('ENGINE_BACKEND_WALLET_ADDRESS') || '';
    this.authToken = this.configService.get<string>('ENGINE_AUTH_TOKEN') || '';

    // Create HTTPS agent that accepts self-signed certificates
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    });

    if (!this.engineBaseUrl || !this.backendWalletAddress || !this.authToken) {
      throw new Error(
        'Missing required engine configuration: ENGINE_BASE_URL, ENGINE_BACKEND_WALLET_ADDRESS, ENGINE_AUTH_TOKEN',
      );
    }
  }

  async writeContract(
    chainId: number,
    contractAddress: string,
    writeRequest: EngineWriteRequest,
  ): Promise<EngineResponse> {
    const url = `${this.engineBaseUrl}/contract/${chainId}/${contractAddress}/write`;

    const headers = {
      'X-Backend-Wallet-Address': this.backendWalletAddress,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.authToken}`,
    };

    const config = {
      headers,
      httpsAgent: this.httpsAgent,
    };

    try {
      this.logger.log(
        `Executing write contract on ${contractAddress} (chain: ${chainId})`,
      );
      this.logger.log(
        `Write request payload: ${JSON.stringify(writeRequest, null, 2)}`,
      );

      const response = await firstValueFrom(
        this.httpService.post<EngineResponse>(url, writeRequest, config),
      );

      this.logger.log(`Engine write request successful for ${contractAddress}`);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage =
        (axiosError.response?.data as { message?: string })?.message ||
        axiosError.message;
      this.logger.error(
        `Engine write request failed for ${contractAddress}:`,
        axiosError.response?.data || axiosError.message,
      );
      throw new Error(`Engine request failed: ${errorMessage}`);
    }
  }

  async readContract(
    chainId: number,
    contractAddress: string,
    functionName: string,
    args: unknown[] = [],
  ): Promise<unknown> {
    const url = `${this.engineBaseUrl}/contract/${chainId}/${contractAddress}/read`;

    const headers = {
      Authorization: `Bearer ${this.authToken}`,
    };

    const params = {
      functionName,
      ...(args.length > 0 && { args: args.join(',') }),
    };

    const config = {
      headers,
      params,
      httpsAgent: this.httpsAgent,
    };

    try {
      this.logger.log(
        `Executing read contract on ${contractAddress} (chain: ${chainId}) - Function: ${functionName}`,
      );

      const response = await firstValueFrom(
        this.httpService.get<unknown>(url, config),
      );

      this.logger.log(`Engine read request successful for ${contractAddress}`);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage =
        (axiosError.response?.data as { message?: string })?.message ||
        axiosError.message;
      this.logger.error(
        `Engine read request failed for ${contractAddress}:`,
        axiosError.response?.data || axiosError.message,
      );
      throw new Error(`Engine read request failed: ${errorMessage}`);
    }
  }

  async getTransactionStatus(queueId: string): Promise<unknown> {
    const url = `${this.engineBaseUrl}/transaction/status/${queueId}`;

    const headers = {
      Authorization: `Bearer ${this.authToken}`,
    };

    const config = {
      headers,
      httpsAgent: this.httpsAgent,
    };

    try {
      this.logger.log(`Getting transaction status for queue ID: ${queueId}`);

      const response = await firstValueFrom(
        this.httpService.get<unknown>(url, config),
      );

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage =
        (axiosError.response?.data as { message?: string })?.message ||
        axiosError.message;
      this.logger.error(
        `Failed to get transaction status for ${queueId}:`,
        axiosError.response?.data || axiosError.message,
      );
      throw new Error(`Failed to get transaction status: ${errorMessage}`);
    }
  }
}
