// Composite Pattern (Patrón Compuesto)

// Ejemplo de la vida real: 

// Un menú de restaurante, imagina que eres el dueño de un restaurante y quieres estructurar tu menú. 
// Tienes:

// Platos individuales (hojas/leaf):
// "Hamburguesa" ($10)
// "Pizza" ($12)

// Combos (compuestos/composite):

// "Combo Familiar" (contiene: 2 hamburguesas + 1 pizza + 1 refresco).
// "Combo Infantil" (contiene: 1 hamburguesa + 1 juguete).

// Problema: 
// Quieres calcular el precio total de cualquier elemento del menú, 
// ya sea un plato individual o un combo (que puede contener otros combos o platos).

// Solución con Composite:
// Tratas todos los elementos del menú (platos y combos) de la misma manera.
// Un combo simplemente suma el precio de sus partes.
// Puedes anidar combos dentro de combos (ej.: un "Combo Mega" que incluye un "Combo Familiar" + un postre).

// Beneficio:
// No necesitas preguntar "¿Es esto un plato o un combo?".
// La estructura es flexible y recursiva.

// Conclusiones:
// El Composite Pattern es ideal para estructuras jerárquicas donde 
// los objetos comparten una interfaz natural (como archivos/carpetas, menús/platos).

// Pero no lo uses si:
// Los objetos son demasiado distintos.
// Las operaciones no aplican a todos.
// La jerarquía es forzada o artificial.


// Componente base (interfaz común)
class Item {
    getPrecio() {
      throw new Error("Método no implementado");
    }
  }
  
// Hoja (producto individual)
class Producto extends Item {
    constructor(nombre, precio) {
        super();
        this.nombre = nombre;
        this.precio = precio;
    }

    getPrecio() {
        return this.precio;
    }
}
  
// Composite (caja que puede contener items)
class Caja extends Item {
    constructor(nombre) {
        super();
        this.nombre = nombre;
        this.items = [];
    }

    add(item) {
        this.items.push(item);
    }

    getPrecio() {
        let total = 0;
        for (const item of this.items) {
            total += item.getPrecio(); // ¡Recursividad si es otra caja!
        }
        return total;
    }
}
  
// --- USO ---
// Productos sueltos
const iPhone = new Producto("iPhone", 1000);
const airpods = new Producto("AirPods", 200);

// Caja pequeña (contiene productos)
const cajaChica = new Caja("Caja Regalo");
cajaChica.add(iPhone);
cajaChica.add(airpods);

// Caja GRANDE (contiene caja chica + otro producto)
const cajaGrande = new Caja("Caja Navideña");
cajaGrande.add(cajaChica);
cajaGrande.add(new Producto("Chocolate", 50));

// ¡Calculamos el precio TOTAL!
console.log(cajaGrande.getPrecio()); // 1250 (1000 + 200 + 50)