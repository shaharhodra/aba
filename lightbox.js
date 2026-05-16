document.addEventListener("DOMContentLoaded", () => {
    const lightbox = document.createElement("div");
    lightbox.className = "lightbox";
    lightbox.innerHTML = `
        <button class="lightbox-close">&times;</button>
        <button class="lightbox-prev" aria-label="תמונה קודמת">&#8250;</button>
        <button class="lightbox-next" aria-label="תמונה הבאה">&#8249;</button>
        <img src="" alt="Enlarged image">
        <div class="lightbox-counter"></div>
    `;
    document.body.appendChild(lightbox);

    const lightboxImg = lightbox.querySelector("img");
    const closeBtn = lightbox.querySelector(".lightbox-close");
    const prevBtn = lightbox.querySelector(".lightbox-prev");
    const nextBtn = lightbox.querySelector(".lightbox-next");
    const counter = lightbox.querySelector(".lightbox-counter");

    let allImages = [];
    let currentIndex = 0;
    let touchStartX = 0;
    let touchEndX = 0;

    function collectImages() {
        allImages = Array.from(document.querySelectorAll("img:not(.no-lightbox)"));
    }

    function showImage(index) {
        if (index < 0 || index >= allImages.length) return;
        currentIndex = index;
        lightboxImg.src = allImages[currentIndex].src;
        counter.textContent = allImages.length > 1 ? `${currentIndex + 1} / ${allImages.length}` : "";
        prevBtn.style.display = allImages.length > 1 ? "" : "none";
        nextBtn.style.display = allImages.length > 1 ? "" : "none";
    }

    function openLightbox(index) {
        collectImages();
        showImage(index);
        lightbox.classList.add("active");
        document.body.style.overflow = "hidden";
    }

    function closeLightbox() {
        lightbox.classList.remove("active");
        setTimeout(() => { lightboxImg.src = ""; }, 300);
        document.body.style.overflow = "auto";
    }

    function goNext() {
        if (allImages.length <= 1) return;
        showImage((currentIndex + 1) % allImages.length);
    }

    function goPrev() {
        if (allImages.length <= 1) return;
        showImage((currentIndex - 1 + allImages.length) % allImages.length);
    }

    function attachClickHandlers() {
        const images = document.querySelectorAll("img:not(.no-lightbox)");
        images.forEach(img => {
            if (img.dataset.lightboxBound) return;
            img.classList.add("clickable-image");
            img.dataset.lightboxBound = "1";
            img.addEventListener("click", () => {
                collectImages();
                const idx = allImages.indexOf(img);
                openLightbox(idx >= 0 ? idx : 0);
            });
        });
    }

    attachClickHandlers();

    const observer = new MutationObserver(() => { attachClickHandlers(); });
    observer.observe(document.body, { childList: true, subtree: true });

    closeBtn.addEventListener("click", closeLightbox);
    prevBtn.addEventListener("click", (e) => { e.stopPropagation(); goPrev(); });
    nextBtn.addEventListener("click", (e) => { e.stopPropagation(); goNext(); });

    lightbox.addEventListener("click", (e) => {
        if (e.target === lightbox) closeLightbox();
    });

    document.addEventListener("keydown", (e) => {
        if (!lightbox.classList.contains("active")) return;
        if (e.key === "Escape") closeLightbox();
        if (e.key === "ArrowLeft") goNext();
        if (e.key === "ArrowRight") goPrev();
    });

    lightbox.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lightbox.addEventListener("touchend", (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) goNext();
            else goPrev();
        }
    }, { passive: true });
});
