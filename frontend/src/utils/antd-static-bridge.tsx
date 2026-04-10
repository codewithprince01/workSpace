import { App } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import type { NotificationInstance } from 'antd/es/notification/interface';
import type { ModalStaticFunctions } from 'antd/es/modal/confirm';
import { message as staticMessage, notification as staticNotification, Modal as staticModal } from 'antd/es';

let message: MessageInstance = staticMessage;
let notification: NotificationInstance = staticNotification;
let modal: Omit<ModalStaticFunctions, 'warn'> = staticModal;

/**
 * Bridge component to capture Ant Design's context-aware instances.
 * Should be rendered inside <AntdApp>.
 */
export default () => {
  const staticFunctions = App.useApp();
  message = staticFunctions.message;
  notification = staticFunctions.notification;
  modal = staticFunctions.modal;
  return null;
};

// Functions that delegate to the current active instance
export const antdMessage: MessageInstance = {
  info: (...args: any[]) => (message.info as any)(...args),
  success: (...args: any[]) => (message.success as any)(...args),
  error: (...args: any[]) => (message.error as any)(...args),
  warning: (...args: any[]) => (message.warning as any)(...args),
  loading: (...args: any[]) => (message.loading as any)(...args),
  open: (...args: any[]) => message.open(...args),
  destroy: (key?: React.Key) => message.destroy(key),
  config: (config: any) => (message as any).config(config),
  useMessage: staticMessage.useMessage,
} as any;

export const antdNotification: NotificationInstance = {
  success: (config: any) => notification.success(config),
  error: (config: any) => notification.error(config),
  info: (config: any) => notification.info(config),
  warning: (config: any) => notification.warning(config),
  open: (config: any) => notification.open(config),
  destroy: (key?: React.Key) => notification.destroy(key),
  config: (config: any) => notification.config(config),
  useNotification: staticNotification.useNotification,
} as any;

export const antdModal: Omit<ModalStaticFunctions, 'warn'> & { useModal: typeof staticModal.useModal } = {
  info: (...args: any[]) => modal.info(...args),
  success: (...args: any[]) => modal.success(...args),
  error: (...args: any[]) => modal.error(...args),
  warning: (...args: any[]) => modal.warning(...args),
  confirm: (...args: any[]) => modal.confirm(...args),
  useModal: staticModal.useModal,
} as any;
