/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module 'sql.js' {
  const initSqlJs: (config?: any) => Promise<any>;
  export default initSqlJs;
}
