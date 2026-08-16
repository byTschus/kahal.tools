type IntegrationCardProps = {
  name: string;
  description: string;
  status?: "Geplant" | "Bereit";
};

export function IntegrationCard({
  name,
  description,
  status = "Geplant",
}: IntegrationCardProps) {
  return (
    <article className="integration-card">
      <div className="card-heading">
        <h2>{name}</h2>
        <span className={status === "Bereit" ? "status ready" : "status"}>{status}</span>
      </div>
      <p>{description}</p>
    </article>
  );
}
