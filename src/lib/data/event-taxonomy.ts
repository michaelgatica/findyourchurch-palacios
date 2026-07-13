import type { EventTaxonomyOption } from "@/lib/types/events";

function createOption(label: string, index: number): EventTaxonomyOption {
  return {
    id: label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
    label,
    slug: label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
    isActive: true,
    sortOrder: index + 1,
  };
}

export const primaryEventTypeOptions = [
  "Worship Service",
  "Special Worship Service",
  "Revival or Evangelistic Service",
  "Prayer Meeting or Prayer Vigil",
  "Bible Study",
  "Sunday School or Christian Education",
  "Small Group or Discipleship",
  "Conference, Summit, or Convention",
  "Workshop, Class, or Seminar",
  "Fellowship or Social Gathering",
  "Community Meal, Banquet, Luncheon, or Potluck",
  "Vacation Bible School",
  "Camp or Retreat",
  "Youth Night",
  "Children's Event",
  "Worship Night, Concert, Choir, Drama, or Arts Event",
  "Outreach or Evangelism",
  "Missions Event",
  "Community Service or Volunteer Opportunity",
  "Food, Clothing, School Supply, or Resource Distribution",
  "Fundraiser",
  "Donation Drive",
  "Holiday or Seasonal Event",
  "Back-to-School Event",
  "Baptism",
  "Communion",
  "Baby or Child Dedication",
  "Membership or New Member Event",
  "Leadership or Ministry Training",
  "Ministry or Organizational Meeting",
  "Support Group or Care Ministry",
  "Grief, Recovery, or Healing Ministry",
  "Health, Wellness, or Blood Drive",
  "Sports or Recreation",
  "School Break or After-School Program",
  "Graduation, Recognition, or Awards Event",
  "Community Fair or Vendor Event",
  "Memorial or Remembrance Event",
  "Other",
].map(createOption);

export const audienceAndMinistryOptions = [
  "Everyone or Community",
  "Men",
  "Women",
  "Couples or Marriage",
  "Parents",
  "Families",
  "Nursery or Preschool",
  "Children",
  "Preteens",
  "Youth or Teens",
  "Young Adults",
  "College and Career",
  "Singles",
  "Seniors",
  "Pastors and Church Leaders",
  "Volunteers",
  "Worship Teams and Musicians",
  "Teachers and Ministry Workers",
  "Special Needs or Disability Ministry",
  "Spanish-speaking",
  "Bilingual",
  "Other language-specific ministry",
].map(createOption);
