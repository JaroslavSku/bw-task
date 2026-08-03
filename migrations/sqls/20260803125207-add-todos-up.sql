create table todos (
    id integer generated always as identity primary key,
    user_id integer not null references users (id) on delete cascade,
    text text not null check (char_length(text) between 1 and 500),
    done boolean not null default false,
    priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
    category text not null default 'other' check (category in ('personal', 'work', 'shopping', 'health', 'other')),
    due_date date,
    created_at timestamptz not null default now(),
    completed_at timestamptz
);

create index todos_user_created_idx on todos (user_id, created_at desc, id desc);

create function notify_todos_changed() returns trigger
language plpgsql as $$
begin
    perform pg_notify(
        'todos_changed',
        json_build_object('userId', coalesce(new.user_id, old.user_id))::text
    );
    return coalesce(new, old);
end;
$$;

create trigger todos_changed_notify
after insert or update or delete on todos
for each row execute function notify_todos_changed();
