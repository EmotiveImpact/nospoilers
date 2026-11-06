import { Toaster as Sonner, toast } from "sonner";

/** App-wide toasts in the redesign look: near-black, hairline border, bottom right. */
export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      gap={8}
      visibleToasts={3}
      toastOptions={{
        classNames: {
          toast: "ns-toast",
          title: "ns-toast-title",
          description: "ns-toast-description",
          success: "ns-toast-success",
          error: "ns-toast-error",
        },
      }}
    />
  );
}

export { toast };
