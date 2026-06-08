create or replace function public.organization_member_role(target_organization_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select om.role
  from public.organization_members om
  where om.organization_id = target_organization_id
    and om.user_id = auth.uid()
    and om.status = 'active'
  limit 1;
$$;

create or replace function public.organization_has_permission(target_organization_id uuid, permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.organization_member_role(target_organization_id)
    when 'owner' then true
    when 'admin' then true
    when 'manager' then permission in (
      'lead:create',
      'lead:update',
      'pipeline:update',
      'conversation:update',
      'conversation:send',
      'task:manage',
      'template:manage',
      'prospecting:use',
      'settings:manage'
    )
    when 'seller' then permission in (
      'lead:create',
      'lead:update',
      'conversation:update',
      'conversation:send',
      'task:manage',
      'template:manage',
      'prospecting:use'
    )
    when 'support' then permission in (
      'conversation:update',
      'conversation:send',
      'task:manage',
      'template:manage'
    )
    else false
  end;
$$;

drop policy if exists "Members can read organization leads" on public.leads;
drop policy if exists "Members can create organization leads" on public.leads;
drop policy if exists "Members can update organization leads" on public.leads;
drop policy if exists "Members can delete organization leads" on public.leads;
drop policy if exists "Members can read organization templates" on public.message_templates;
drop policy if exists "Members can create organization templates" on public.message_templates;
drop policy if exists "Members can update organization templates" on public.message_templates;
drop policy if exists "Members can delete organization templates" on public.message_templates;
drop policy if exists "Members can read organization interactions" on public.interactions;
drop policy if exists "Members can create organization interactions" on public.interactions;
drop policy if exists "Members can delete organization interactions" on public.interactions;
drop policy if exists "Members can read organization tasks" on public.tasks;
drop policy if exists "Members can read organization whatsapp messages" on public.whatsapp_messages;
drop policy if exists "Members can read organization whatsapp conversations" on public.whatsapp_conversations;
drop policy if exists "Members can read organization tags" on public.tags;
drop policy if exists "Members can read organization lead tags" on public.lead_tags;
drop policy if exists "Members can read organization conversation tags" on public.whatsapp_conversation_tags;
drop policy if exists "Members can read organization prospecting campaigns" on public.prospecting_campaigns;
drop policy if exists "Members can read organization prospecting campaign contacts" on public.prospecting_campaign_contacts;

drop policy if exists "Members can manage organization leads" on public.leads;
create policy "Members can read organization leads"
  on public.leads for select
  using (
    (organization_id is not null and public.is_organization_member(organization_id))
    or (organization_id is null and auth.uid() = user_id)
  );
create policy "Members can create organization leads"
  on public.leads for insert
  with check (
    (organization_id is not null and public.organization_has_permission(organization_id, 'lead:create'))
    or (organization_id is null and auth.uid() = user_id)
  );
create policy "Members can update organization leads"
  on public.leads for update
  using (
    (organization_id is not null and (
      public.organization_has_permission(organization_id, 'lead:update')
      or public.organization_has_permission(organization_id, 'pipeline:update')
    ))
    or (organization_id is null and auth.uid() = user_id)
  )
  with check (
    (organization_id is not null and (
      public.organization_has_permission(organization_id, 'lead:update')
      or public.organization_has_permission(organization_id, 'pipeline:update')
    ))
    or (organization_id is null and auth.uid() = user_id)
  );
create policy "Members can delete organization leads"
  on public.leads for delete
  using (
    (organization_id is not null and public.organization_has_permission(organization_id, 'lead:delete'))
    or (organization_id is null and auth.uid() = user_id)
  );

drop policy if exists "Members can manage organization templates" on public.message_templates;
create policy "Members can read organization templates"
  on public.message_templates for select
  using (
    (organization_id is not null and public.is_organization_member(organization_id))
    or (organization_id is null and auth.uid() = user_id)
  );
create policy "Members can create organization templates"
  on public.message_templates for insert
  with check (
    (organization_id is not null and public.organization_has_permission(organization_id, 'template:manage'))
    or (organization_id is null and auth.uid() = user_id)
  );
create policy "Members can update organization templates"
  on public.message_templates for update
  using (
    (organization_id is not null and public.organization_has_permission(organization_id, 'template:manage'))
    or (organization_id is null and auth.uid() = user_id)
  )
  with check (
    (organization_id is not null and public.organization_has_permission(organization_id, 'template:manage'))
    or (organization_id is null and auth.uid() = user_id)
  );
create policy "Members can delete organization templates"
  on public.message_templates for delete
  using (
    (organization_id is not null and public.organization_has_permission(organization_id, 'template:manage'))
    or (organization_id is null and auth.uid() = user_id)
  );

drop policy if exists "Members can manage organization interactions" on public.interactions;
create policy "Members can read organization interactions"
  on public.interactions for select
  using (
    (organization_id is not null and public.is_organization_member(organization_id))
    or (organization_id is null and auth.uid() = user_id)
  );
create policy "Members can create organization interactions"
  on public.interactions for insert
  with check (
    (organization_id is not null and public.organization_has_permission(organization_id, 'lead:update'))
    or (organization_id is null and auth.uid() = user_id)
  );
create policy "Members can delete organization interactions"
  on public.interactions for delete
  using (
    (organization_id is not null and public.organization_has_permission(organization_id, 'lead:update'))
    or (organization_id is null and auth.uid() = user_id)
  );

drop policy if exists "Members can manage organization tasks" on public.tasks;
create policy "Members can read organization tasks"
  on public.tasks for select
  using (
    (organization_id is not null and public.is_organization_member(organization_id))
    or (organization_id is null and auth.uid() = user_id)
  );
create policy "Members can manage organization tasks"
  on public.tasks for all
  using (
    (organization_id is not null and public.organization_has_permission(organization_id, 'task:manage'))
    or (organization_id is null and auth.uid() = user_id)
  )
  with check (
    (organization_id is not null and public.organization_has_permission(organization_id, 'task:manage'))
    or (organization_id is null and auth.uid() = user_id)
  );

drop policy if exists "Members can manage organization whatsapp messages" on public.whatsapp_messages;
create policy "Members can read organization whatsapp messages"
  on public.whatsapp_messages for select
  using (
    (organization_id is not null and public.is_organization_member(organization_id))
    or (organization_id is null and auth.uid() = user_id)
  );
create policy "Members can manage organization whatsapp messages"
  on public.whatsapp_messages for all
  using (
    (organization_id is not null and (
      public.organization_has_permission(organization_id, 'conversation:update')
      or public.organization_has_permission(organization_id, 'conversation:send')
    ))
    or (organization_id is null and auth.uid() = user_id)
  )
  with check (
    (organization_id is not null and (
      public.organization_has_permission(organization_id, 'conversation:update')
      or public.organization_has_permission(organization_id, 'conversation:send')
    ))
    or (organization_id is null and auth.uid() = user_id)
  );

drop policy if exists "Members can manage organization whatsapp conversations" on public.whatsapp_conversations;
create policy "Members can read organization whatsapp conversations"
  on public.whatsapp_conversations for select
  using (
    (organization_id is not null and public.is_organization_member(organization_id))
    or (organization_id is null and auth.uid() = user_id)
  );
create policy "Members can manage organization whatsapp conversations"
  on public.whatsapp_conversations for all
  using (
    (organization_id is not null and (
      public.organization_has_permission(organization_id, 'conversation:update')
      or public.organization_has_permission(organization_id, 'conversation:send')
    ))
    or (organization_id is null and auth.uid() = user_id)
  )
  with check (
    (organization_id is not null and (
      public.organization_has_permission(organization_id, 'conversation:update')
      or public.organization_has_permission(organization_id, 'conversation:send')
    ))
    or (organization_id is null and auth.uid() = user_id)
  );

drop policy if exists "Members can read organization whatsapp logs" on public.whatsapp_logs;
create policy "Members can read organization whatsapp logs"
  on public.whatsapp_logs for select
  using (
    (organization_id is not null and public.is_organization_member(organization_id))
    or (organization_id is null and auth.uid() = user_id)
  );

drop policy if exists "Members can read organization audit logs" on public.audit_logs;
drop policy if exists "Members can create organization audit logs" on public.audit_logs;
create policy "Members can read organization audit logs"
  on public.audit_logs for select
  using (
    (organization_id is not null and public.is_organization_member(organization_id))
    or (organization_id is null and auth.uid() = user_id)
  );
create policy "Members can create organization audit logs"
  on public.audit_logs for insert
  with check (
    (organization_id is not null and public.is_organization_member(organization_id))
    or (organization_id is null and auth.uid() = user_id)
  );

drop policy if exists "Members can manage organization tags" on public.tags;
create policy "Members can read organization tags"
  on public.tags for select
  using (
    (organization_id is not null and public.is_organization_member(organization_id))
    or (organization_id is null and auth.uid() = user_id)
  );
create policy "Members can manage organization tags"
  on public.tags for all
  using (
    (organization_id is not null and public.organization_has_permission(organization_id, 'lead:update'))
    or (organization_id is null and auth.uid() = user_id)
  )
  with check (
    (organization_id is not null and public.organization_has_permission(organization_id, 'lead:update'))
    or (organization_id is null and auth.uid() = user_id)
  );

drop policy if exists "Members can manage organization lead tags" on public.lead_tags;
create policy "Members can read organization lead tags"
  on public.lead_tags for select
  using (
    (organization_id is not null and public.is_organization_member(organization_id))
    or (organization_id is null and auth.uid() = user_id)
  );
create policy "Members can manage organization lead tags"
  on public.lead_tags for all
  using (
    (organization_id is not null and public.organization_has_permission(organization_id, 'lead:update'))
    or (organization_id is null and auth.uid() = user_id)
  )
  with check (
    (organization_id is not null and public.organization_has_permission(organization_id, 'lead:update'))
    or (organization_id is null and auth.uid() = user_id)
  );

drop policy if exists "Members can manage organization conversation tags" on public.whatsapp_conversation_tags;
create policy "Members can read organization conversation tags"
  on public.whatsapp_conversation_tags for select
  using (
    (organization_id is not null and public.is_organization_member(organization_id))
    or (organization_id is null and auth.uid() = user_id)
  );
create policy "Members can manage organization conversation tags"
  on public.whatsapp_conversation_tags for all
  using (
    (organization_id is not null and public.organization_has_permission(organization_id, 'conversation:update'))
    or (organization_id is null and auth.uid() = user_id)
  )
  with check (
    (organization_id is not null and public.organization_has_permission(organization_id, 'conversation:update'))
    or (organization_id is null and auth.uid() = user_id)
  );

drop policy if exists "Members can manage organization prospecting campaigns" on public.prospecting_campaigns;
create policy "Members can read organization prospecting campaigns"
  on public.prospecting_campaigns for select
  using (
    (organization_id is not null and public.is_organization_member(organization_id))
    or (organization_id is null and auth.uid() = user_id)
  );
create policy "Members can manage organization prospecting campaigns"
  on public.prospecting_campaigns for all
  using (
    (organization_id is not null and public.organization_has_permission(organization_id, 'prospecting:use'))
    or (organization_id is null and auth.uid() = user_id)
  )
  with check (
    (organization_id is not null and public.organization_has_permission(organization_id, 'prospecting:use'))
    or (organization_id is null and auth.uid() = user_id)
  );

drop policy if exists "Members can manage organization prospecting campaign contacts" on public.prospecting_campaign_contacts;
create policy "Members can read organization prospecting campaign contacts"
  on public.prospecting_campaign_contacts for select
  using (
    (organization_id is not null and public.is_organization_member(organization_id))
    or (organization_id is null and auth.uid() = user_id)
  );
create policy "Members can manage organization prospecting campaign contacts"
  on public.prospecting_campaign_contacts for all
  using (
    (organization_id is not null and public.organization_has_permission(organization_id, 'prospecting:use'))
    or (organization_id is null and auth.uid() = user_id)
  )
  with check (
    (organization_id is not null and public.organization_has_permission(organization_id, 'prospecting:use'))
    or (organization_id is null and auth.uid() = user_id)
  );
