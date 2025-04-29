//Null Object Pattern (Patrón Objeto Nulo)

// 📚 Ejemplo de la vida real: Un carrito de compras

// Imagina que tienes un carrito de compras en una tienda online. Algunos usuarios están logueados, otros no (invitados).

// Usuario registrado (objeto real):
// Tiene nombre, dirección, historial de compras.
// Puede aplicar descuentos.

// Usuario invitado (objeto nulo):
// No tiene nombre ni datos.
// No aplica descuentos.

// Problema:
// En el código, tendrías que estar preguntando: "¿Hay un usuario logueado?" antes de acceder a sus datos o descuentos.
// Esto genera muchos if/else y errores si el usuario es null.

// Solución con Null Object:
// Creas un "Usuario Invitado" que actúa como un usuario real, pero:
// Su nombre es "Invitado".
// Sus descuentos son $0.
// Su dirección es "No especificada".

// Beneficio:
// El código trata tanto al usuario real como al invitado de la misma forma.
// No hay que validar constantemente "¿Existe el usuario?".


// 1. Definimos las clases (sin interfaz abstracta, ya que JS no la necesita)
class RealMessage {
  constructor(text) {
    this.text = text;
  }

  getText() {
    return this.text;
  }
}

class NullMessage {
  getText() {
    return "No hay mensaje";
  }
}

// 2. Función que procesa el mensaje (sin if/else)
function showMessage(message) {
  console.log(message.getText());
}

// 3. Uso con objetos válidos y nulos
const mensajeValido = new RealMessage("¡Hola!");
const mensajeVacio = new NullMessage();

showMessage(mensajeValido); // "¡Hola!"
showMessage(mensajeVacio);  // "No hay mensaje"

// 4. ¡Extra! Función helper para evitar null/undefined
function createMessage(text) {
  return text ? new RealMessage(text) : new NullMessage();
}

showMessage(createMessage("Mensaje real")); // "Mensaje real"
showMessage(createMessage(null));          // "No hay mensaje"


// Resumiendo todo esto, el null object pattern es util cuando quiero evitar null checks
// y tener un objeto que me permita hacer operaciones sin tener que preocuparme por nulls
// Tambien es util cuando quiero tener un objeto que me permita hacer operaciones sin tener que preocuparme por nulls