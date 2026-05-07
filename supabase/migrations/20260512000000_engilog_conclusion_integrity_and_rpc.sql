-- EngiLog: defense-in-depth for conclusion answers and a transactional
-- replace-list RPC for classroom conclusion questions.

-- 1. Trigger: ensure project_conclusion_answers.question_id belongs to the
--    same classroom as the project. RLS only checks project membership; this
--    closes the cross-classroom integrity hole.
create or replace function public.project_conclusion_answers_check_classroom()
returns trigger
language plpgsql
as $$
declare
  v_project_classroom uuid;
  v_question_classroom uuid;
begin
  select classroom_id into v_project_classroom
    from public.projects where id = new.project_id;
  select classroom_id into v_question_classroom
    from public.classroom_conclusion_questions where id = new.question_id;

  if v_project_classroom is null or v_question_classroom is null then
    raise exception 'Project or question is missing classroom_id.';
  end if;
  if v_project_classroom is distinct from v_question_classroom then
    raise exception 'Conclusion answer must reference a question in the same classroom as the project.';
  end if;
  return new;
end;
$$;

drop trigger if exists project_conclusion_answers_check_classroom on public.project_conclusion_answers;
create trigger project_conclusion_answers_check_classroom
  before insert or update on public.project_conclusion_answers
  for each row execute function public.project_conclusion_answers_check_classroom();

-- 2. Transactional replace-list RPC for classroom conclusion questions.
--    Accepts an array of {id?, prompt, position}; matches by id when present,
--    inserts when missing, and deletes anything not in the keep set. Runs in
--    a single transaction so partial saves can't corrupt question order.
create or replace function public.set_classroom_conclusion_questions(
  p_classroom uuid,
  p_questions jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_keep uuid[] := array[]::uuid[];
  rec jsonb;
  v_id uuid;
  v_prompt text;
  v_pos int;
begin
  if v_user is null then
    raise exception 'You must be signed in.';
  end if;
  if not public.is_classroom_teacher(p_classroom, v_user) then
    raise exception 'Only classroom teachers can edit conclusion questions.';
  end if;

  if jsonb_typeof(p_questions) is distinct from 'array' then
    raise exception 'p_questions must be a JSON array.';
  end if;

  for rec in select * from jsonb_array_elements(p_questions)
  loop
    v_prompt := coalesce(trim(rec ->> 'prompt'), '');
    if v_prompt = '' then
      continue;
    end if;
    v_pos := coalesce((rec ->> 'position')::int, 0);
    v_id := nullif(rec ->> 'id', '')::uuid;

    if v_id is not null then
      update public.classroom_conclusion_questions
        set prompt = v_prompt, position = v_pos
        where id = v_id and classroom_id = p_classroom;
      v_keep := array_append(v_keep, v_id);
    else
      insert into public.classroom_conclusion_questions (classroom_id, prompt, position)
      values (p_classroom, v_prompt, v_pos)
      returning id into v_id;
      v_keep := array_append(v_keep, v_id);
    end if;
  end loop;

  delete from public.classroom_conclusion_questions
   where classroom_id = p_classroom
     and (v_keep is null or not (id = any (v_keep)));
end;
$$;

grant execute on function public.set_classroom_conclusion_questions(uuid, jsonb) to authenticated;
