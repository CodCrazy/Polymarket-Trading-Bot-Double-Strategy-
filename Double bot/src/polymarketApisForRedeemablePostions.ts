/**
 * Polymarket Data API client
 */
import axios, { AxiosInstance } from 'axios';
import { PolymarketPosition } from './types';
// import { config } from './config';

export class PolymarketApiClient {
  private client: AxiosInstance;
  private baseUrl = 'https://data-api.polymarket.com';

  constructor() {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get current positions for a user
   * @param userAddress - User's proxy wallet address
   * @param options - Optional filters
   */
  async getPositions(
    userAddress: string,
    options: {
      redeemable?: boolean;
      mergeable?: boolean;
      limit?: number;
      offset?: number;
      sortBy?: string;
      sortDirection?: 'ASC' | 'DESC';
    } = {}
  ): Promise<PolymarketPosition[]> {
    try {
      // Validate userAddress
      if (!userAddress || userAddress.trim() === '' || userAddress === 'undefined') {
        throw new Error('userAddress is required and must be a valid address');
      }

      const params: Record<string, any> = {
        user: userAddress.trim(),
        ...options,
      };

      // Remove undefined, null, and empty string values (except 'user' which is required)
      Object.keys(params).forEach(
        (key) => {
          const value = params[key];
          if (key !== 'user' && (value === undefined || value === null || value === '')) {
            delete params[key];
          }
        }
      );

      const response = await this.client.get<PolymarketPosition[]>('/positions', {
        params,
      });

      return response.data;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        console.error('API Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
        });
        throw new Error(
          `Failed to fetch positions: ${error.response?.statusText || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Get only redeemable positions
   */
  async getRedeemablePositions(userAddress: string): Promise<PolymarketPosition[]> {
    return this.getPositions(userAddress, {
      redeemable: true,
      limit: 500, // Max allowed
      sortBy: 'RESOLVING',
      sortDirection: 'ASC', // Oldest first
    });
  }
}

