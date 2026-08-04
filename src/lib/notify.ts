import { toast } from "sonner";
import type { ReactNode } from "react";

interface NotifyAction {
  label: string;
  onClick: () => void | Promise<void>;
}

interface NotifyIdOption {
  id?: string | number;
}

type NotifyBaseOptions = { duration?: number; icon?: ReactNode | null } & (
  | { description?: string; action?: never }
  | { description?: never; action?: NotifyAction }
);

function base(message: string, opts?: NotifyBaseOptions) {
  return toast(message, opts);
}

function success(message: string, opts?: NotifyIdOption) {
  return toast.success(message, opts);
}

function error(
  message: string,
  opts?: NotifyIdOption & { description?: string; action?: never },
) {
  return toast.error(message, opts);
}

function warning(message: string, opts?: NotifyIdOption) {
  return toast.warning(message, opts);
}

function info(message: string, opts?: NotifyIdOption) {
  return toast.info(message, opts);
}

function loading(message: string, opts?: NotifyIdOption) {
  return toast.loading(message, opts);
}

function dismiss(id?: string | number) {
  return toast.dismiss(id);
}

export const notify = Object.assign(base, {
  success,
  error,
  warning,
  info,
  loading,
  dismiss,
  promise: toast.promise,
});
