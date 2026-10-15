"use client";

import { createContext, useContext } from "react";
import { METRIC, type DisplayUnits } from "@/lib/units";

/** Unidades de exibição escolhidas nos critérios. Só afeta o que aparece na tela. */
export const UnitsContext = createContext<DisplayUnits>(METRIC);
export const useUnits = () => useContext(UnitsContext);
