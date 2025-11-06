const WITHOUT_RAG_LABEL = 'Answer with conventional AI assistant';
const WITH_RAG_LABEL = 'Answer with <strong><u>our</u></strong> RAG AI assistant';
const TYPING_INTERVAL_MS = 10;

function stripTags(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

function buildRichMarkup(text) {
    return `<span class="msg-rich-content">${text}</span>`;
}

function measureRichTextHeight(text, referenceEl) {
    if (!referenceEl) return 0;
    const refRect = referenceEl.getBoundingClientRect();
    const width = Math.max(0, Math.floor(refRect.width));

    const meas = document.createElement('div');
    meas.style.position = 'absolute';
    meas.style.visibility = 'hidden';
    meas.style.left = '-9999px';
    meas.style.top = '0';
    meas.style.width = `${width}px`;
    meas.style.boxSizing = 'border-box';

    const refStyle = window.getComputedStyle(referenceEl);
    meas.style.font = refStyle.font || `${refStyle.fontSize} ${refStyle.fontFamily}`;
    meas.style.padding = refStyle.padding;
    meas.style.border = refStyle.border;
    meas.style.whiteSpace = 'pre-wrap';
    meas.style.wordBreak = refStyle.wordBreak || 'break-word';
    meas.style.lineHeight = refStyle.lineHeight;
    meas.style.letterSpacing = refStyle.letterSpacing;

    if (text && /<[^>]+>/.test(text)) {
        meas.innerHTML = buildRichMarkup(text);
    } else {
        meas.textContent = text;
    }

    document.body.appendChild(meas);
    const height = meas.offsetHeight;
    document.body.removeChild(meas);
    return height;
}

function equalizeButtonHeights(firstBtn, secondBtn) {
    if (!firstBtn || !secondBtn) return;
    firstBtn.style.height = '';
    secondBtn.style.height = '';
    const firstRect = firstBtn.getBoundingClientRect();
    const secondRect = secondBtn.getBoundingClientRect();
    const maxHeight = Math.max(firstRect.height, secondRect.height);
    firstBtn.style.height = `${maxHeight}px`;
    secondBtn.style.height = `${maxHeight}px`;
}

function scheduleEqualization(...callbacks) {
    requestAnimationFrame(() => {
        callbacks.forEach((callback) => {
            if (typeof callback === 'function') {
                callback();
            }
        });
    });
}

function typeIntoElement(targetEl, text, intervalMs, onComplete) {
    targetEl.textContent = '';
    let position = 0;
    const intervalId = setInterval(() => {
        targetEl.textContent += text.charAt(position);
        position += 1;
        if (position >= text.length) {
            clearInterval(intervalId);
            if (typeof onComplete === 'function') {
                onComplete();
            }
        }
    }, intervalMs);
}

const ragScenarios = [
    {
        question: 'Which radiology services are included in the dental coverage?',
        withoutRag: 'Dental coverage typically focuses on routine oral health services, so radiology services might be limited. The plan may include general X-rays, but the details depend on the provider. Please check your policy documents or contact support for the most accurate list.',
        withRag: `The radiology services included in the dental coverage are:
 ·Orthopantomography (panoramic X-ray)
 ·Intraoral Scanner
 ·Intraoral Camera Photographs
 ·Periapical / Bitewing / Occlusal X-ray
 ·Computed Axial Tomography (Dental CT Scan)
 ·Radiological Study for Orthodontics
 ·Lateral Skull X-ray
(...)
All these services are included at no additional cost (Inc.)¹ ²<div class="badge-list badge-list--notes">
 <span class="badge badge--note">¹ Dental Policy.pdf page=2</span>
 <span class="badge badge--note">² Dental Policy.pdf page=6</span>
</div>`,
        explanation: 'With RAG, the system retrieves specific information from the provided sources, allowing it to list the exact radiology services included in the dental coverage. Without RAG, it gives a generic answer due to lack of specific data.'
    },
    {
        question: 'What is the recipe for “arròs al forn”?',
        withoutRag: 'Arròs al forn (“rice baked in the oven”) is a traditional Valencian dish — hearty, comforting, and full of rich, smoky flavors. It’s typically made with leftover stew broth and simple ingredients like pork ribs, sausages, chickpeas, and tomato. Here’s a classic recipe: (...)',
        withRag: 'I don’t have information about the recipe for "arròs al forn" in the provided sources.',
        explanation: 'With RAG, the system only answers using information found in its sources, and since none mention arròs al forn, it correctly responds that it has no data on it.'
    }
];

let currentIndex = 0;
let cleanupCurrentScenario = null;

const sliderViewport = document.getElementById('sliderViewport');
const sliderContent = document.getElementById('sliderContent');
const sliderPrevButton = document.getElementById('sliderPrev');
const sliderNextButton = document.getElementById('sliderNext');
const SLIDE_DISTANCE = 60;
const CONTENT_TRANSITION_SPEC = 'transform 0.35s cubic-bezier(.4,1.3,.5,1), opacity 0.25s ease';
const HEIGHT_TRANSITION_SPEC = 'height 0.35s ease';
const ANIMATION_DURATION = 350;
const HEIGHT_RESET_DELAY = 450;

function renderScenario(idx, animate = false, direction = 'right') {
    const scenario = ragScenarios[idx];
    const html = `
    <div class="scenario-wrap">
        <h2 class="scenario-question" aria-live="polite">${scenario.question}</h2>
        <div class="scenario-explanation" id="scenarioExplanation" aria-live="polite" hidden><strong>Why this outcome?</strong> ${scenario.explanation}</div>
        <div class="response-columns">
            <div class="response-column">
                <button id="noRagBtn" class="btn w-full px-4 py-3 rounded-md border border-blue-200 bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">${WITHOUT_RAG_LABEL}</button>
                <div class="msg mt-3 border border-gray-200 bg-gray-50 text-gray-700 p-4 rounded-md min-h-[3rem] w-full break-words" id="noRagMsg" aria-live="polite"></div>
            </div>
            <div class="response-column">
                <button id="ragBtn" class="btn w-full px-4 py-3 rounded-md border border-blue-200 bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">${WITH_RAG_LABEL}</button>
                <div class="msg mt-3 border border-gray-200 bg-gray-50 text-gray-700 p-4 rounded-md min-h-[3rem] w-full break-words" id="ragMsg" aria-live="polite"></div>
            </div>
        </div>
    </div>
    `;

    const slideOffset = direction === 'right' ? -SLIDE_DISTANCE : SLIDE_DISTANCE;

    if (cleanupCurrentScenario) {
        cleanupCurrentScenario();
        cleanupCurrentScenario = null;
    }

    const mountContent = () => {
        sliderContent.innerHTML = html;
        cleanupCurrentScenario = attachScenarioEvents(scenario, animate);
    };

    if (animate) {
        const previousHeight = sliderViewport.offsetHeight || sliderContent.offsetHeight;
        sliderViewport.style.height = `${previousHeight}px`;
        sliderViewport.style.transition = HEIGHT_TRANSITION_SPEC;
        sliderContent.style.transition = CONTENT_TRANSITION_SPEC;
        sliderContent.style.opacity = '1';
        sliderContent.style.transform = 'translateX(0)';

        requestAnimationFrame(() => {
            sliderContent.style.opacity = '0';
            sliderContent.style.transform = `translateX(${slideOffset}px)`;
        });

        setTimeout(() => {
            mountContent();
            const nextHeight = sliderContent.offsetHeight;
            sliderViewport.style.transition = 'none';
            sliderViewport.style.height = `${previousHeight}px`;
            sliderContent.style.transition = 'none';
            sliderContent.style.opacity = '0';
            sliderContent.style.transform = `translateX(${-slideOffset}px)`;
            sliderViewport.getBoundingClientRect();

            requestAnimationFrame(() => {
                sliderViewport.style.transition = HEIGHT_TRANSITION_SPEC;
                sliderViewport.style.height = `${nextHeight}px`;
                sliderContent.style.transition = CONTENT_TRANSITION_SPEC;
                sliderContent.style.opacity = '1';
                sliderContent.style.transform = 'translateX(0)';
            });

            setTimeout(() => {
                sliderViewport.style.height = '';
                sliderViewport.style.transition = '';
                sliderContent.style.transition = CONTENT_TRANSITION_SPEC;
            }, HEIGHT_RESET_DELAY);
        }, ANIMATION_DURATION);
    } else {
        mountContent();
        sliderViewport.style.height = '';
        sliderViewport.style.transition = '';
        sliderContent.style.opacity = '1';
        sliderContent.style.transform = 'translateX(0)';
        sliderContent.style.transition = CONTENT_TRANSITION_SPEC;
    }
}

function attachScenarioEvents(scenario, animateTransition) {
    const noRagBtn = document.getElementById('noRagBtn');
    const ragBtn = document.getElementById('ragBtn');
    const noRagMsg = document.getElementById('noRagMsg');
    const ragMsg = document.getElementById('ragMsg');
    const explanationEl = document.getElementById('scenarioExplanation');
    const responseColumns = document.querySelector('.response-columns');

    if (!noRagBtn || !ragBtn || !noRagMsg || !ragMsg) {
        return () => {};
    }

    noRagBtn.innerHTML = WITHOUT_RAG_LABEL;
    noRagBtn.setAttribute('aria-label', stripTags(WITHOUT_RAG_LABEL));
    ragBtn.innerHTML = WITH_RAG_LABEL;
    ragBtn.setAttribute('aria-label', stripTags(WITH_RAG_LABEL));

    const noRagText = scenario.withoutRag;
    const ragText = scenario.withRag;
    let withoutRagRevealed = false;
    let withRagRevealed = false;
    let explanationShown = false;

    const applyEqualHeights = () => {
        const noRagHeight = measureRichTextHeight(noRagText, noRagMsg);
        const ragHeight = measureRichTextHeight(ragText, ragMsg);
        const maxHeight = Math.max(noRagHeight, ragHeight);
        noRagMsg.style.height = `${maxHeight}px`;
        ragMsg.style.height = `${maxHeight}px`;
        noRagMsg.style.minHeight = noRagMsg.style.minHeight || '';
        ragMsg.style.minHeight = ragMsg.style.minHeight || '';
    };

    const applyEqualButtonHeights = () => {
        equalizeButtonHeights(noRagBtn, ragBtn);
    };

    const scheduleEqualAdjustments = () => scheduleEqualization(applyEqualHeights, applyEqualButtonHeights);

    if (animateTransition) {
        applyEqualHeights();
        applyEqualButtonHeights();
    }
    scheduleEqualAdjustments();

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(scheduleEqualAdjustments).catch(() => {});
    }

    const resizeObserver = typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(scheduleEqualAdjustments)
        : null;

    if (resizeObserver && responseColumns) {
        resizeObserver.observe(responseColumns);
    }

    const onResize = () => {
        scheduleEqualAdjustments();
    };

    window.addEventListener('resize', onResize);

    const onNoRagClick = () => handleClick(noRagBtn, noRagMsg, noRagText, 'without');
    const onRagClick = () => handleClick(ragBtn, ragMsg, ragText, 'with');

    noRagBtn.addEventListener('click', onNoRagClick);
    ragBtn.addEventListener('click', onRagClick);

    [noRagBtn, ragBtn].forEach((button) => {
        button.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                button.click();
            }
        });
    });

    function animateViewportHeight(previousHeight, afterFrame) {
        if (!previousHeight) {
            if (typeof afterFrame === 'function') {
                afterFrame();
            }
            return;
        }
        sliderViewport.style.height = `${previousHeight}px`;
        sliderViewport.style.transition = HEIGHT_TRANSITION_SPEC;
        sliderViewport.getBoundingClientRect();

        requestAnimationFrame(() => {
            if (typeof afterFrame === 'function') {
                afterFrame();
            }
            const nextHeight = sliderContent.offsetHeight;
            sliderViewport.style.height = `${nextHeight}px`;
        });

        setTimeout(() => {
            sliderViewport.style.height = '';
            sliderViewport.style.transition = '';
        }, HEIGHT_RESET_DELAY);
    }

    function handleClick(button, targetEl, text, which) {
        if (button.disabled) return;
        button.disabled = true;
        button.style.pointerEvents = 'none';
        typeIntoElement(targetEl, text, TYPING_INTERVAL_MS, () => {
            if (text.includes('<')) {
                targetEl.innerHTML = buildRichMarkup(text);
            }
        });
        if (which === 'without') {
            withoutRagRevealed = true;
        } else if (which === 'with') {
            withRagRevealed = true;
        }
        maybeShowExplanation();
    }

    function maybeShowExplanation() {
        if (!explanationShown && withoutRagRevealed && withRagRevealed && explanationEl) {
            explanationShown = true;
            const previousHeight = sliderViewport.offsetHeight || sliderContent.offsetHeight;
            explanationEl.hidden = false;
            animateViewportHeight(previousHeight, () => {
                explanationEl.classList.add('visible');
            });
        }
    }

    return () => {
        window.removeEventListener('resize', onResize);
        if (resizeObserver) {
            resizeObserver.disconnect();
        }
        noRagBtn.removeEventListener('click', onNoRagClick);
        ragBtn.removeEventListener('click', onRagClick);
    };
}

function updateSliderButtons() {
    if (sliderPrevButton) {
        sliderPrevButton.disabled = currentIndex === 0;
        sliderPrevButton.style.cursor = sliderPrevButton.disabled ? 'not-allowed' : 'pointer';
        sliderPrevButton.style.pointerEvents = sliderPrevButton.disabled ? 'none' : 'auto';
    }
    if (sliderNextButton) {
        sliderNextButton.disabled = currentIndex === ragScenarios.length - 1;
        sliderNextButton.style.cursor = sliderNextButton.disabled ? 'not-allowed' : 'pointer';
        sliderNextButton.style.pointerEvents = sliderNextButton.disabled ? 'none' : 'auto';
    }
}

if (sliderPrevButton) {
    sliderPrevButton.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex -= 1;
            renderScenario(currentIndex, true, 'left');
            updateSliderButtons();
        }
    });
}

if (sliderNextButton) {
    sliderNextButton.addEventListener('click', () => {
        if (currentIndex < ragScenarios.length - 1) {
            currentIndex += 1;
            renderScenario(currentIndex, true, 'right');
            updateSliderButtons();
        }
    });
}

renderScenario(currentIndex);
updateSliderButtons();
