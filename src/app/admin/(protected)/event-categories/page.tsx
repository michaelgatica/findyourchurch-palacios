import { savePlatformCategoryAction } from "@/lib/actions/platform-events";
import { listPlatformCategories } from "@/lib/services/platform-event-admin-service";
import { eventCategoryGroups } from "@/lib/types/events";

interface AdminEventCategoriesPageProps {
  searchParams: Promise<{ group?: string }>;
}

export default async function AdminEventCategoriesPage({ searchParams }: AdminEventCategoriesPageProps) {
  const params = await searchParams;
  const activeGroup = eventCategoryGroups.includes(params.group as never) ? params.group : "all";
  const categories = await listPlatformCategories(activeGroup as never);

  return (
    <div className="admin-content">
      <div className="panel">
        <p className="eyebrow eyebrow--gold">Event taxonomy</p>
        <h1>Manage public event categories</h1>
        <p className="supporting-text">
          Category keys stay stable after use. Changing a label updates future display text without
          corrupting historical event records.
        </p>
      </div>

      <form action={savePlatformCategoryAction} className="panel admin-filter-form">
        <select name="group" defaultValue="primary_type" required>
          {eventCategoryGroups.map((group) => <option key={group} value={group}>{group.replaceAll("_", " ")}</option>)}
        </select>
        <input name="key" placeholder="Internal key, optional" />
        <input name="label" placeholder="Public label" required />
        <input name="description" placeholder="Description" />
        <input name="icon" placeholder="Icon metadata" />
        <input name="sortOrder" type="number" defaultValue="0" />
        <label className="admin-checkbox"><input name="isActive" type="checkbox" defaultChecked /> Active</label>
        <label className="admin-checkbox"><input name="isPrimary" type="checkbox" /> Primary option</label>
        <button className="button button--primary">Add category</button>
      </form>

      <div className="admin-card-list">
        {categories.map((category) => (
          <form key={category.id} action={savePlatformCategoryAction} className="panel admin-card-list__item">
            <input type="hidden" name="id" value={category.id} />
            <div className="admin-card-list__header">
              <div>
                <p className="eyebrow">{category.group.replaceAll("_", " ")}</p>
                <h2>{category.label}</h2>
                <p className="supporting-text">Key: {category.key}</p>
              </div>
              <span className={`status-badge status-badge--${category.isActive ? "published" : "archived"}`}>{category.isActive ? "active" : "inactive"}</span>
            </div>
            <div className="admin-filter-form">
              <select name="group" defaultValue={category.group}>
                {eventCategoryGroups.map((group) => <option key={group} value={group}>{group.replaceAll("_", " ")}</option>)}
              </select>
              <input name="label" defaultValue={category.label} />
              <input name="description" defaultValue={category.description ?? ""} />
              <input name="icon" defaultValue={category.icon ?? ""} />
              <input name="sortOrder" type="number" defaultValue={category.sortOrder} />
              <label className="admin-checkbox"><input name="isActive" type="checkbox" defaultChecked={category.isActive} /> Active</label>
              <label className="admin-checkbox"><input name="isPrimary" type="checkbox" defaultChecked={category.isPrimary} /> Primary</label>
              <button className="button button--secondary">Save category</button>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
}

