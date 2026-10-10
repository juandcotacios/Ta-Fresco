import {
  calcularEstadoGlobal,
  esEstadoFinal,
  unidadesADevolver,
  validarTransicionEstado,
  PedidoItem,
} from "./pedidosEstadoMachine";

describe("esEstadoFinal", () => {
  it("marca 'entregado' y 'cancelado' como finales", () => {
    expect(esEstadoFinal("entregado")).toBe(true);
    expect(esEstadoFinal("cancelado")).toBe(true);
  });

  it("no marca los estados activos como finales", () => {
    expect(esEstadoFinal("pendiente")).toBe(false);
    expect(esEstadoFinal("confirmado")).toBe(false);
    expect(esEstadoFinal("en_camino")).toBe(false);
  });
});

describe("validarTransicionEstado", () => {
  it("permite avanzar un paso a la vez, en orden", () => {
    expect(() => validarTransicionEstado("pendiente", "confirmado")).not.toThrow();
    expect(() => validarTransicionEstado("confirmado", "en_camino")).not.toThrow();
    expect(() => validarTransicionEstado("en_camino", "entregado")).not.toThrow();
  });

  it("no deja saltarse un estado", () => {
    expect(() => validarTransicionEstado("pendiente", "en_camino")).toThrow();
    expect(() => validarTransicionEstado("pendiente", "entregado")).toThrow();
  });

  it("no deja retroceder", () => {
    expect(() => validarTransicionEstado("en_camino", "pendiente")).toThrow();
    expect(() => validarTransicionEstado("confirmado", "pendiente")).toThrow();
  });

  it("permite cancelar desde cualquier estado activo", () => {
    expect(() => validarTransicionEstado("pendiente", "cancelado")).not.toThrow();
    expect(() => validarTransicionEstado("confirmado", "cancelado")).not.toThrow();
    expect(() => validarTransicionEstado("en_camino", "cancelado")).not.toThrow();
  });

  it("no deja tocar un pedido que ya llegó a un estado final", () => {
    expect(() => validarTransicionEstado("entregado", "cancelado")).toThrow();
    expect(() => validarTransicionEstado("entregado", "confirmado")).toThrow();
    expect(() => validarTransicionEstado("cancelado", "pendiente")).toThrow();
    expect(() => validarTransicionEstado("cancelado", "cancelado")).toThrow();
  });
});

describe("calcularEstadoGlobal", () => {
  it("usa el estado más atrasado entre las tiendas activas", () => {
    const estados = { tiendaA: "en_camino" as const, tiendaB: "pendiente" as const };
    expect(calcularEstadoGlobal(estados, ["tiendaA", "tiendaB"])).toBe("pendiente");
  });

  it("ignora las tiendas canceladas si alguna sigue activa", () => {
    const estados = { tiendaA: "entregado" as const, tiendaB: "cancelado" as const };
    expect(calcularEstadoGlobal(estados, ["tiendaA", "tiendaB"])).toBe("entregado");
  });

  it("solo da 'cancelado' si TODAS las tiendas cancelaron", () => {
    const estados = { tiendaA: "cancelado" as const, tiendaB: "cancelado" as const };
    expect(calcularEstadoGlobal(estados, ["tiendaA", "tiendaB"])).toBe("cancelado");
  });

  it("trata una tienda sin estado registrado como 'pendiente'", () => {
    expect(calcularEstadoGlobal({}, ["tiendaA"])).toBe("pendiente");
  });
});

describe("unidadesADevolver", () => {
  const items: PedidoItem[] = [
    { id: "prod1", name: "Tomate", price: 1000, quantity: 3, proveedorId: "tiendaA" },
    { id: "prod2", name: "Papa", price: 2000, quantity: 5, proveedorId: "tiendaB" },
  ];

  it("devuelve las cantidades de los ítems que no estaban cancelados", () => {
    const resultado = unidadesADevolver(items, {}, "pendiente");
    expect(resultado).toEqual({ prod1: 3, prod2: 5 });
  });

  it("no cuenta dos veces lo que ya estaba cancelado antes de este cambio", () => {
    const estadosPorProveedor = { tiendaA: "cancelado" as const, tiendaB: "pendiente" as const };
    const resultado = unidadesADevolver(items, estadosPorProveedor, "pendiente");
    expect(resultado).toEqual({ prod2: 5 });
  });

  it("con soloProveedorId, solo devuelve las unidades de esa tienda", () => {
    const resultado = unidadesADevolver(items, {}, "pendiente", "tiendaA");
    expect(resultado).toEqual({ prod1: 3 });
  });

  it("suma cantidades cuando dos ítems del pedido son el mismo producto", () => {
    const itemsRepetidos: PedidoItem[] = [
      { id: "prod1", name: "Tomate", price: 1000, quantity: 2, proveedorId: "tiendaA" },
      { id: "prod1", name: "Tomate", price: 1000, quantity: 1, proveedorId: "tiendaA" },
    ];
    const resultado = unidadesADevolver(itemsRepetidos, {}, "pendiente");
    expect(resultado).toEqual({ prod1: 3 });
  });
});
