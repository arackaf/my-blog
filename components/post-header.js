import DateFormatter from "../components/date-formatter";

export default function PostHeader({ title, coverImage, date, author }) {
  return (
    <>
      <h1>XX{title}</h1>
      <div>
        <div>
          <DateFormatter dateString={date} />
        </div>
      </div>
    </>
  );
}
