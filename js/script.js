document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("waitlist-form");
  const note = document.getElementById("waitlist-note");

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = document.getElementById("email").value.trim();
      if (!email) return;

      note.textContent = `You're on the list, ${email}. We'll let you know when the tree opens.`;
      note.classList.add("is-success");
      form.reset();
    });
  }
});
