export const EVENT_BUS = Symbol('EVENT_BUS');

export type EventBusLike = {
  publish: (event: any) => Promise<void> | void;
  emit?: (event: any) => Promise<void> | void;
};
