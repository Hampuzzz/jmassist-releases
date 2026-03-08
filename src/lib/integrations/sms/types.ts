// 46elks SMS API types

export interface SmsRequest {
  from: string;
  to: string;
  message: string;
}

export interface SmsResponse {
  id: string;
  status: string;
  created: string;
  direction: string;
  from: string;
  to: string;
  message: string;
  cost: number;
}

export interface SmsError {
  missing?: string;
  message?: string;
}
