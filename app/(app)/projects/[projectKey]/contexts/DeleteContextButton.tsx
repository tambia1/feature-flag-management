"use client";

import { useActionState } from "react";
import { Button } from "@/app/_components/Button";
import { Message } from "@/app/_components/Message";
import { deleteContext } from "./actions";

type Props = {
  contextId: string;
  disabled: boolean;
};

export const DeleteContextButton = ({ contextId, disabled }: Props) => {
  const [state, formAction, isPending] = useActionState(deleteContext, {});

  return (
    <form action={formAction}>
      <input type="hidden" name="contextId" value={contextId} />
      <Button type="submit" variant="link" color="danger" disabled={disabled || isPending}>
        {isPending ? "Deleting…" : "Delete"}
      </Button>
      <Message text={state.error} state="error" />
    </form>
  );
};
