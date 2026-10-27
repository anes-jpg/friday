import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { QueryClientProvider } from "@tanstack/react-query";
import { workspaceQueryClient } from "./lib/query";
import "./styles/theme.css";
import { useProjects } from "./lib/projects";
import { useSavedPlaces } from "./lib/saved-places";

void useProjects.getState().hydrate().then(() => useSavedPlaces.getState().hydrate());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={workspaceQueryClient}><App /></QueryClientProvider>
  </React.StrictMode>
);
