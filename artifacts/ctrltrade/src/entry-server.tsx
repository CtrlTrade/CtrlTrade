import { renderToString } from "react-dom/server";
import { AppPublic } from "./AppPublic";

export function render(url: string): string {
  return renderToString(<AppPublic ssrPath={url} />);
}
