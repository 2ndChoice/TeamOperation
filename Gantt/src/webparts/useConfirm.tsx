import * as React from "react";
import { Dialog, DialogType, DialogFooter } from "@fluentui/react/lib/Dialog";
import { PrimaryButton, DefaultButton } from "@fluentui/react/lib/Button";

type ConfirmState = {
  isOpen: boolean;
  title?: string;
  message?: string;
  resolve?: (v: boolean) => void;
};

export function useConfirm() {
  const [state, setState] = React.useState<ConfirmState>({ isOpen: false });

  const confirm = React.useCallback((title: string, message: string) => {
    return new Promise<boolean>((resolve) => {
      setState({ isOpen: true, title, message, resolve });
    });
  }, []);

  const onClose = React.useCallback((result: boolean) => {
    const resolver = state.resolve;
    setState({ isOpen: false });
    resolver?.(result);
  }, [state.resolve]);

  const ConfirmDialog = React.useMemo(() => {
    return (
      <Dialog
        hidden={!state.isOpen}
        onDismiss={() => onClose(false)}
        dialogContentProps={{
          type: DialogType.normal,
          title: state.title ?? "Confirm",
          subText: state.message ?? ""
        }}
        modalProps={{ isBlocking: true }}
      >
        <DialogFooter>
          <PrimaryButton onClick={() => onClose(true)} text="Confirm" />
          <DefaultButton onClick={() => onClose(false)} text="Cancel" />
        </DialogFooter>
      </Dialog>
    );
  }, [state.isOpen, state.title, state.message, onClose]);

  return { confirm, ConfirmDialog };
}