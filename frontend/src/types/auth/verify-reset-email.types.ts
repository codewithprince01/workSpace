export interface IUpdatePasswordRequest {
  token?: string;
  password?: string;
  user?: string;
  hash?: string;
  confirmPassword?: string;
}
