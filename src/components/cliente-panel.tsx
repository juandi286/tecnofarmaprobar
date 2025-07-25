'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign, Package, AlertTriangle, Settings, CalendarOff, PackagePlus, TimerOff, PlusCircle, Mail } from 'lucide-react';
import { format, isBefore, isWithinInterval, addDays, subDays, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Pie, PieChart, Cell } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

import { type Producto, type MovimientoInventario, TipoMovimiento } from '@/lib/types';
import { Switch } from './ui/switch';

interface ClientePanelProps {
  productosIniciales: Producto[];
  movimientosIniciales: MovimientoInventario[];
}

export function ClientePanel({ productosIniciales, movimientosIniciales }: ClientePanelProps) {
  const [productos, setProductos] = useState<Producto[]>(productosIniciales);
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>(movimientosIniciales);
  const [umbralStockBajo, setUmbralStockBajo] = useState(10);
  const [umbralDiasVencimiento, setUmbralDiasVencimiento] = useState(30);
  const [umbralDiasLentoMovimiento, setUmbralDiasLentoMovimiento] = useState(90);
  const [alertasVencimiento, setAlertasVencimiento] = useState<Producto[]>([]);
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Actualiza el estado interno si las props cambian
    setProductos(productosIniciales);
  }, [productosIniciales]);

   useEffect(() => {
    setMovimientos(movimientosIniciales);
  }, [movimientosIniciales]);
  
  useEffect(() => {
    if (!isClient) return;
    const hoy = new Date();
    const fechaUmbral = addDays(hoy, umbralDiasVencimiento);
    const alertas = productos.filter(p => isWithinInterval(new Date(p.fechaVencimiento), { start: subDays(hoy, 1), end: fechaUmbral }));
    setAlertasVencimiento(alertas);
  }, [productos, umbralDiasVencimiento, isClient]);

  const { totalValorInventario, totalUnidades } = useMemo(() => {
    const valor = productos.reduce((acc, p) => acc + p.precio * p.cantidad, 0);
    const unidades = productos.reduce((acc, p) => acc + p.cantidad, 0);
    return { totalValorInventario: valor, totalUnidades: unidades };
  }, [productos]);


  const alertasStockBajo = useMemo(() =>
    productos.filter((p) => p.cantidad > 0 && p.cantidad <= umbralStockBajo),
    [productos, umbralStockBajo]
  );
  
  const alertasLentoMovimiento = useMemo(() => {
    if (!isClient) return [];

    const umbralFecha = subDays(new Date(), umbralDiasLentoMovimiento);
    const tiposDeSalida = [TipoMovimiento.SALIDA_MANUAL, TipoMovimiento.DISPENSADO_RECETA, TipoMovimiento.VENTA_KIT];

    const ultimoMovimientoSalida = new Map<string, Date>();
    movimientos
      .filter(m => tiposDeSalida.includes(m.tipo))
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .forEach(m => {
        if (!ultimoMovimientoSalida.has(m.productoId)) {
          ultimoMovimientoSalida.set(m.productoId, new Date(m.fecha));
        }
      });

    return productos.filter(producto => {
      const fechaUltimoMovimiento = ultimoMovimientoSalida.get(producto.id);
      
      if (!fechaUltimoMovimiento) {
        const movimientoCreacion = movimientos.find(m => 
            m.productoId === producto.id && 
            [TipoMovimiento.CREACION_INICIAL, TipoMovimiento.IMPORTACION_CSV].includes(m.tipo)
        );
        const fechaCreacion = movimientoCreacion ? new Date(movimientoCreacion.fecha) : new Date(0);
        return isBefore(fechaCreacion, umbralFecha);
      }
      
      return isBefore(fechaUltimoMovimiento, umbralFecha);
    }).map(producto => ({
        ...producto,
        ultimoMovimiento: ultimoMovimientoSalida.get(producto.id)
    }));
  }, [productos, movimientos, umbralDiasLentoMovimiento, isClient]);


  const productosRecientes = useMemo(() => {
    return [...productos]
        .sort((a, b) => b.id.localeCompare(a.id))
        .slice(0, 5);
  }, [productos]);

  const distribucionCategorias = useMemo(() => {
    if (productos.length === 0) return [];
    
    const conteo = productos.reduce((acc, producto) => {
      acc[producto.categoria] = (acc[producto.categoria] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(conteo)
        .map(([categoria, total], index) => ({
            categoria,
            total,
            fill: `hsl(var(--chart-${(index % 5) + 1}))`
        }))
        .sort((a, b) => b.total - a.total);
  }, [productos]);

  const chartConfig = useMemo(() => ({
    total: {
      label: 'Total',
    },
    ...distribucionCategorias.reduce((acc, item) => {
        acc[item.categoria] = { label: item.categoria, color: item.fill };
        return acc;
    }, {} as ChartConfig)
  }), [distribucionCategorias]) satisfies ChartConfig;

  
  return (
    <Tabs defaultValue="panel" className="space-y-4">
      <TabsList>
        <TabsTrigger value="panel">Panel de Control</TabsTrigger>
        <TabsTrigger value="alerts">Alertas</TabsTrigger>
      </TabsList>

      <TabsContent value="panel">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total del Inventario</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                 {isClient ? new Intl.NumberFormat('es-CO', {
                  style: 'currency',
                  currency: 'COP',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(totalValorInventario) : '$ 0'}
              </div>
              <p className="text-xs text-muted-foreground">
                Calculado sobre {productos.length} productos
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unidades Totales en Stock</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isClient ? totalUnidades.toLocaleString('es-CO') : '0'}</div>
              <p className="text-xs text-muted-foreground">
                Sumatoria de todos los productos
              </p>
            </CardContent>
          </Card>
           <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertas de Stock Bajo</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{alertasStockBajo.length}</div>
              <p className="text-xs text-muted-foreground">
                Umbral: {umbralStockBajo} unidades
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Próximos a Vencer</CardTitle>
              <CalendarOff className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{alertasVencimiento.length}</div>
              <p className="text-xs text-muted-foreground">
                En los próximos {umbralDiasVencimiento} días
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Distribución por Categoría</CardTitle>
                    <CardDescription>
                        Visualización de la cantidad de productos en cada categoría.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                  {distribucionCategorias.length > 0 ? (
                    <ChartContainer config={chartConfig} className="min-h-[250px] w-full aspect-auto">
                      <PieChart>
                          <ChartTooltip
                              cursor={false}
                              content={<ChartTooltipContent hideLabel nameKey="categoria" />}
                          />
                          <Pie data={distribucionCategorias} dataKey="total" nameKey="categoria" innerRadius={60}>
                             {distribucionCategorias.map((entry) => (
                                <Cell key={`cell-${entry.categoria}`} fill={entry.fill} />
                            ))}
                          </Pie>
                      </PieChart>
                    </ChartContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[250px]">
                      <p className="text-sm text-muted-foreground">No hay datos para mostrar el gráfico.</p>
                    </div>
                  )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Productos Recientes</CardTitle>
                    <CardDescription>
                        Los últimos productos agregados al inventario.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {productosRecientes.length > 0 ? (
                            productosRecientes.map(producto => (
                                <div key={producto.id} className="flex items-center">
                                    <div className="p-2 bg-muted rounded-full mr-4">
                                        <PackagePlus className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div className="flex-grow">
                                        <p className="text-sm font-medium">{producto.nombre}</p>
                                        <p className="text-xs text-muted-foreground">{producto.categoria} - Lote: {producto.numeroLote}</p>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {isClient ? format(new Date(producto.fechaVencimiento), 'dd/MM/yy') : ''}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex items-center justify-center h-[250px]">
                                <p className="text-sm text-muted-foreground">No hay productos recientes.</p>
                             </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
      </TabsContent>

      <TabsContent value="alerts" className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Settings className="h-6 w-6 text-muted-foreground" />
              <div>
                <CardTitle>Configuración de Alertas</CardTitle>
                <CardDescription>
                  Define los umbrales para las notificaciones de inventario.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
              <div className="space-y-2">
                <Label htmlFor="stock-threshold">Umbral de Stock Bajo</Label>
                <Input
                  id="stock-threshold"
                  type="number"
                  value={umbralStockBajo}
                  onChange={(e) =>
                    setUmbralStockBajo(
                      Number(e.target.value) >= 0 ? Number(e.target.value) : 0
                    )
                  }
                  min="0"
                />
                <p className="text-sm text-muted-foreground">
                  Recibir alertas para productos con esta cantidad o menos.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiry-threshold">
                  Umbral de Vencimiento (días)
                </Label>
                <Input
                  id="expiry-threshold"
                  type="number"
                  value={umbralDiasVencimiento}
                  onChange={(e) =>
                    setUmbralDiasVencimiento(
                      Number(e.target.value) >= 0 ? Number(e.target.value) : 0
                    )
                  }
                  min="0"
                />
                <p className="text-sm text-muted-foreground">
                  Alertar sobre productos que vencen en los próximos X días.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="slow-moving-threshold">
                  Umbral de Lento Movimiento (días)
                </Label>
                <Input
                  id="slow-moving-threshold"
                  type="number"
                  value={umbralDiasLentoMovimiento}
                  onChange={(e) =>
                    setUmbralDiasLentoMovimiento(
                      Number(e.target.value) >= 0 ? Number(e.target.value) : 0
                    )
                  }
                  min="0"
                />
                <p className="text-sm text-muted-foreground">
                  Alertar sobre productos sin salida en los últimos X días.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-notifications">Notificaciones por Correo</Label>
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch id="email-notifications" />
                    <Label htmlFor="email-notifications" className="text-sm text-muted-foreground font-normal cursor-pointer">
                        Habilitar envío de alertas críticas por correo electrónico.
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Se enviará un resumen al correo del administrador.
                  </p>
              </div>
            </div>
          </CardContent>
        </Card>

         <div className="space-y-6">
            <div>
               <h3 className="text-lg font-medium mb-2">Alertas de Stock Bajo ({alertasStockBajo.length})</h3>
               <div className="space-y-4">
                  {alertasStockBajo.length > 0 ? (
                     alertasStockBajo.map(producto => (
                        <div key={producto.id} className="flex items-center gap-4">
                            <Alert className="flex-grow">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>{producto.nombre}</AlertTitle>
                                <AlertDescription>
                                Stock bajo: {producto.cantidad} unidades restantes.
                                </AlertDescription>
                            </Alert>
                             <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => router.push(`/panel/pedidos?productoId=${producto.id}&proveedorId=${producto.proveedorId || ''}`)}
                                disabled={!producto.proveedorId}
                                title={!producto.proveedorId ? "El producto debe tener un proveedor asignado para crear un pedido." : "Crear pedido de reposición"}
                            >
                                <PlusCircle className="mr-2 h-4 w-4"/>
                                Crear Pedido
                            </Button>
                        </div>
                     ))
                  ) : <p className="text-sm text-muted-foreground">No hay alertas de stock bajo.</p>}
               </div>
            </div>
             <div>
               <h3 className="text-lg font-medium mb-2">Alertas de Vencimiento ({alertasVencimiento.length})</h3>
               <div className="space-y-4">
                  {alertasVencimiento.length > 0 ? (
                     alertasVencimiento.map(producto => (
                       <Alert key={producto.id} variant={isClient && isBefore(new Date(producto.fechaVencimiento), new Date()) ? 'destructive' : 'default'}>
                         <AlertTriangle className="h-4 w-4" />
                         <AlertTitle>{producto.nombre} ({producto.numeroLote})</AlertTitle>
                         <AlertDescription>
                           {isClient && isBefore(new Date(producto.fechaVencimiento), new Date()) ? 'Ha vencido el' : 'Vence el'} {isClient ? format(new Date(producto.fechaVencimiento), 'PPP', { locale: es }) : ''}.
                         </AlertDescription>
                       </Alert>
                     ))
                  ) : <p className="text-sm text-muted-foreground">No hay productos próximos a vencer.</p>}
               </div>
            </div>
            <div>
               <h3 className="text-lg font-medium mb-2">Alertas de Lento Movimiento ({alertasLentoMovimiento.length})</h3>
               <div className="space-y-4">
                  {alertasLentoMovimiento.length > 0 ? (
                      alertasLentoMovimiento.map(producto => (
                        <Alert key={producto.id}>
                          <TimerOff className="h-4 w-4" />
                          <AlertTitle>{producto.nombre}</AlertTitle>
                          <AlertDescription>
                            {isClient && (producto as any).ultimoMovimiento 
                                ? `Última salida ${formatDistanceToNow(new Date((producto as any).ultimoMovimiento), { locale: es, addSuffix: true })}.`
                                : 'No ha registrado salidas.'
                            }
                            {' '}Stock actual: {producto.cantidad} unidades.
                          </AlertDescription>
                        </Alert>
                      ))
                  ) : <p className="text-sm text-muted-foreground">No hay productos con movimiento lento.</p>}
               </div>
            </div>
         </div>
      </TabsContent>
      
    </Tabs>
  );
}
