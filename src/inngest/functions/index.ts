import { helloWorld } from "./hello-world";
import { sendFormNotification } from "./form-notification";

export { helloWorld, sendFormNotification };
export const functions = [helloWorld, sendFormNotification];
