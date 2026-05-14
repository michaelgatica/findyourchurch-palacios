import { ChurchListingEditorForm } from "@/components/portal/church-listing-editor-form";
import {
  getLatestChangesRequestedUpdateDraft,
  mergeChurchRecordWithDraft,
} from "@/lib/services/church-update-service";
import { getRepresentativePortalContext } from "@/lib/services/representative-access-service";

export default async function PortalChurchEditPage() {
  const context = await getRepresentativePortalContext();

  if (!context?.church) {
    return null;
  }

  const changesRequestedUpdate = await getLatestChangesRequestedUpdateDraft({
    churchId: context.church.id,
    submittedByUserId: context.profile.id,
  });
  const editableChurch = changesRequestedUpdate
    ? mergeChurchRecordWithDraft(context.church, changesRequestedUpdate.proposedChanges)
    : context.church;

  return (
    <div className="admin-content">
      <div className="panel">
        <p className="eyebrow eyebrow--gold">Edit Listing</p>
        <h1>Update church information</h1>
        <p className="supporting-text">
          Keep public details accurate and welcoming. Depending on your church settings, your
          changes may publish immediately or go to the admin review queue for approval.
        </p>
      </div>

      <ChurchListingEditorForm
        church={editableChurch}
        changesRequestedUpdate={
          changesRequestedUpdate
            ? {
                id: changesRequestedUpdate.id,
                adminMessage: changesRequestedUpdate.adminMessage,
                requestedChangesAt: changesRequestedUpdate.requestedChangesAt,
              }
            : undefined
        }
      />
    </div>
  );
}
