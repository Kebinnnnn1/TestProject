# Workspace Collaboration

Add the ability to invite other CUlink users to your workspace docs, so they can view or edit them alongside you — with live updates pushed via the existing Pusher integration.

## User Review Required

> [!IMPORTANT]
> **Scope decision needed — please pick one of these tiers:**
>
> **Tier A — Shared Access** *(simpler, ~1–2 hours work)*
> - Invite users by username to a doc (view-only or edit)
> - Shared docs appear in their workspace sidebar
> - When a collaborator saves a change, the doc owner gets a Pusher notification and, if they're on the same page, their view auto-refreshes
>
> **Tier B — Live Collaborative Editing** *(complex, ~3–5 hours work)*
> - Everything in Tier A, plus:
> - Multiple cursors / presence indicators ("Alice is editing…")
> - Changes broadcast to all viewers in real-time via Pusher as they type
> - Last-write-wins conflict resolution (no OT/CRDTs)
>
> **Recommendation**: Start with Tier A. It covers 90% of the real-world use case and is rock solid. Tier B can be layered on top later.

> [!WARNING]
> This requires a **database migration** (new `WorkspaceCollaborator` table). On Vercel + NeonDB this runs automatically via the Django startup hook — but confirm this is acceptable before proceeding.

## Proposed Changes (Tier A)

---

### Backend — Model

#### [MODIFY] models.py
Add a `WorkspaceCollaborator` join table:
```python
class WorkspaceCollaborator(models.Model):
    ROLE_VIEWER = 'viewer'
    ROLE_EDITOR = 'editor'
    ROLE_CHOICES = [(ROLE_VIEWER,'Viewer'), (ROLE_EDITOR,'Editor')]

    doc       = ForeignKey(WorkspaceDoc, CASCADE, related_name='collaborators')
    user      = ForeignKey(CustomUser,   CASCADE, related_name='shared_docs')
    role      = CharField(max_length=10, choices=ROLE_CHOICES, default=ROLE_EDITOR)
    invited_at = DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('doc', 'user')
```

Also add a `is_shared` flag to `WorkspaceDoc` for quick filtering.

---

### Backend — Views & URLs

#### [MODIFY] views.py
New endpoints:
| URL | Method | Description |
|-----|--------|-------------|
| `/workspace/doc/<pk>/invite/` | POST | Add a collaborator by username + role |
| `/workspace/doc/<pk>/collaborators/` | GET | List collaborators (for the invite panel) |
| `/workspace/doc/<pk>/collaborator/<uid>/remove/` | POST | Remove a collaborator |
| `/workspace/item/<pk>/update/` | POST (existing) | Now also fires a Pusher event `ws-doc-updated` on the doc's channel |

Permission logic:
- Editors can add/edit/delete items (same as owner)
- Viewers can only read (the backend validates this)
- Only the owner can invite or remove collaborators

Shared docs are included in the workspace `GET /workspace/` response alongside owned docs, with an `is_shared` + `role` flag.

#### [MODIFY] urls.py
Wire the 3 new endpoints above.

---

### Pusher — Real-time refresh

#### [MODIFY] views.py (existing item update/create/delete)
After any item mutation, if the doc has collaborators, push a `ws-doc-updated` event to channel `ws-doc-<pk>`. Payload:
```json
{ "doc_pk": 42, "updated_by": "alice" }
```

---

### Frontend — workspace.html

#### [MODIFY] workspace.html

**1. Sidebar** — Shared docs appear under a new "**Shared With Me**" group with a small avatar/icon of the owner.

**2. Doc header** — A **`<i class="bi bi-people"></i> Share`** button appears next to the delete button (only for the owner). Clicking opens the invite panel.

**3. Invite Panel (modal)** — A new lightweight modal:
- Search/type a username
- Pick role: Viewer / Editor
- Hit "Invite" → calls `/workspace/doc/<pk>/invite/`
- Shows current collaborators list with remove (×) button

**4. Collaborator avatars** — In the doc header, small avatar circles show who has access (max 3 + overflow count).

**5. Pusher subscription** — On mounting a doc, subscribe to `ws-doc-<pk>`. When `ws-doc-updated` fires and the updater isn't the current user, silently reload the doc's items from the server and re-render.

---

## Open Questions

> [!IMPORTANT]
> 1. **Tier A or Tier B?** (Recommendation: Tier A to start)
> 2. Should **viewers** still be able to check off todos / mark goals done? Or truly read-only?
> 3. Should collaboration be limited to **verified users only** (already the case for workspace access)?
> 4. Do you want an **email notification** when someone invites you to a doc?

## Verification Plan

### Automated
- Run `python manage.py makemigrations --check` to validate the model changes
- `python manage.py migrate` on local sqlite to confirm migration works

### Manual
- Log in as User A, create a doc, invite User B as editor
- Log in as User B, confirm doc appears in sidebar
- User B edits an item → User A's view auto-updates
- Verify User B (viewer) cannot delete items
