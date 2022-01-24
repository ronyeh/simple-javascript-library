import { MathUtils } from "./math.js";

class SimpleJSLib {
    static sayHello() {
        console.log("Hello!");
    }

    static doMath() {
        console.log("3 + 2 - 7 = ???");
        const a = MathUtils.add(3, 2);
        const b = MathUtils.subtract(a, 7);
        console.log("The answer is:", b);
        return b;
    }
}

export { SimpleJSLib };
export default SimpleJSLib;
