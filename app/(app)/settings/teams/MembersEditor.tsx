"use client";

import { Plus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/app/_components/Button";
import { Input } from "@/app/_components/Input";
import { Message } from "@/app/_components/Message";
import { addTeamMember, removeTeamMember } from "../actions";
import styles from "./MembersEditor.module.css";
import { Text } from "@/app/_components/Text";

type Person = { id: string; name: string };

type Props = {
  teamId: string;
  members: Person[];
  candidates: (Person & { role: string })[];
};

export const MembersEditor = ({ teamId, members, candidates }: Props) => {
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const run = (action: typeof addTeamMember, userId: string) => {
    setError(undefined);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("teamId", teamId);
      formData.set("userId", userId);
      const result = await action({}, formData);
      setError(result.error);
    });
  };

  const matches = candidates.filter((user) => user.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={styles.members}>
      <ul className={styles.chips}>
        {members.length === 0 && (
          <Text as="li" variant="small" color="muted">
            No members yet.
          </Text>
        )}
        {members.map((member) => (
          <li key={member.id} className={styles.chip}>
            {member.name}
            <Button
              variant="plain"
              className={styles.remove}
              onClick={() => run(removeTeamMember, member.id)}
              disabled={isPending}
              aria-label={`Remove ${member.name}`}
            >
              <X size={14} />
            </Button>
          </li>
        ))}
        <li>
          <Button variant="link" onClick={() => setAdding(!adding)} aria-expanded={adding}>
            <Plus size={14} /> Add member
          </Button>
        </li>
      </ul>
      {adding && (
        <div className={styles.picker}>
          <Input
            compact
            type="search"
            placeholder="Search users…"
            aria-label="Search users"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <ul className={styles.options}>
            {matches.length === 0 && (
              <Text as="li" variant="small" color="muted">
                Only users not in this team are listed. No matches.
              </Text>
            )}
            {matches.map((user) => (
              <li key={user.id}>
                <Button variant="plain" className={styles.option} onClick={() => run(addTeamMember, user.id)} disabled={isPending}>
                  <span>{user.name}</span>
                  <Text variant="plain" color="muted">
                    {user.role.toLowerCase()}
                  </Text>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Message text={error} state="error" />
    </div>
  );
};
