document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        // Create participants list HTML
        const participantsList = details.participants.length > 0
          ? `
            <p><strong>Current Participants:</strong></p>
            <ul class="participants-list">
              ${details.participants.map(email => `
                <li>
                  <div class="participant-row">
                    <span class="participant-email">${email}</span>
                    <button class="participant-delete" data-activity="${encodeURIComponent(name)}" data-email="${encodeURIComponent(email)}" title="Unregister">\u232b</button>
                  </div>
                </li>
              `).join('')}
            </ul>`
          : `<p><em>No participants yet - be the first to join!</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-section">
            ${participantsList}
          </div>
        `;

        activitiesList.appendChild(activityCard);

          // attach delete handlers for participant buttons
          activityCard.querySelectorAll('.participant-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const activityName = decodeURIComponent(btn.dataset.activity);
              const email = decodeURIComponent(btn.dataset.email);

              // optimistic UI: disable button while request runs
              btn.disabled = true;

              try {
                const resp = await fetch(`/activities/${encodeURIComponent(activityName)}/unregister?email=${encodeURIComponent(email)}`, {
                  method: 'POST'
                });

                if (resp.ok) {
                  // remove participant row from DOM
                  const li = btn.closest('li');
                  if (li) {
                    li.remove();
                    // Update spots available after successful unregister
                    const activityCard = btn.closest('.activity-card');
                    if (activityCard) {
                      const availabilityP = Array.from(activityCard.querySelectorAll('p')).find(p => p.textContent.includes('Availability'));
                      if (availabilityP) {
                        const match = availabilityP.textContent.match(/(\d+) spots left/);
                        if (match) {
                          const spots = parseInt(match[1], 10) + 1;
                          availabilityP.innerHTML = `<strong>Availability:</strong> ${spots} spots left`;
                        }
                      }
                    }
                  }
                } else {
                  const err = await resp.json();
                  console.error('Failed to unregister:', err);
                  btn.disabled = false;
                  alert(err.detail || 'Failed to unregister participant');
                }
              } catch (error) {
                console.error('Error unregistering participant:', error);
                btn.disabled = false;
                alert('Error unregistering participant');
              }
            });
          });

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();
        // Update UI so the newly signed-up participant appears without refresh
        // Find the activity card for this activity and update spots and participants
        const cards = document.querySelectorAll('.activity-card');
        cards.forEach(card => {
          const title = card.querySelector('h4')?.textContent;
          if (title === activity) {
            // Update spots left
            const availabilityP = Array.from(card.querySelectorAll('p')).find(p => p.textContent.includes('Availability'));
            if (availabilityP) {
              // parse current spots left then decrement
              const match = availabilityP.textContent.match(/(\d+) spots left/);
              if (match) {
                const spots = Math.max(0, parseInt(match[1], 10) - 1);
                availabilityP.innerHTML = `<strong>Availability:</strong> ${spots} spots left`;
              }
            }

            // Ensure participants list exists
            let participantsSection = card.querySelector('.participants-section');
            if (!participantsSection) {
              participantsSection = document.createElement('div');
              participantsSection.className = 'participants-section';
              card.appendChild(participantsSection);
            }

            let ul = participantsSection.querySelector('.participants-list');
            if (!ul) {
              participantsSection.innerHTML = `<p><strong>Current Participants:</strong></p><ul class="participants-list"></ul>`;
              ul = participantsSection.querySelector('.participants-list');
            }

            // append new participant li with delete button
            const li = document.createElement('li');
            li.innerHTML = `
              <div class="participant-row">
                <span class="participant-email">${email}</span>
                <button class="participant-delete" data-activity="${encodeURIComponent(activity)}" data-email="${encodeURIComponent(email)}" title="Unregister">\u232b</button>
              </div>
            `;
            ul.appendChild(li);

            // attach handler to the new delete button
            const newBtn = li.querySelector('.participant-delete');
            if (newBtn) {
                newBtn.addEventListener('click', async () => {
                newBtn.disabled = true;
                try {
                  const resp = await fetch(`/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`, { method: 'POST' });
                  if (resp.ok) {
                    li.remove();
                    // Update spots available after successful unregister
                    const availabilityP = Array.from(card.querySelectorAll('p')).find(p => p.textContent.includes('Availability'));
                    if (availabilityP) {
                      const match = availabilityP.textContent.match(/(\d+) spots left/);
                      if (match) {
                        const spots = parseInt(match[1], 10) + 1;
                        availabilityP.innerHTML = `<strong>Availability:</strong> ${spots} spots left`;
                      }
                    }
                  } else {
                    const err = await resp.json();
                    alert(err.detail || 'Failed to unregister participant');
                    newBtn.disabled = false;
                  }
                } catch (error) {
                  console.error('Error unregistering participant:', error);
                  alert('Error unregistering participant');
                  newBtn.disabled = false;
                }
              });
            }
            
          }
        });
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();
});
