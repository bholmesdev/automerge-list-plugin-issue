/** @jsxImportSource react */

import { Inspector as _Inspector } from "tinybase/ui-react-inspector";
import { Provider } from "tinybase/ui-react";
import { store } from "./app/db";

export function Inspector() {
  return <Provider store={store}>{/*<_Inspector />*/}</Provider>;
}
