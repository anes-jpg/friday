import sys
import os

# Vendor path injection
vendor_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../vendor'))
if vendor_path not in sys.path:
    sys.path.insert(0, vendor_path)

# Depending on exact crewai structure in vendor, you might need to adjust imports
try:
    # the sys.path.insert is handled above
    sys.path.insert(0, os.path.join(vendor_path, 'crewAI', 'lib'))
    from crewai import Agent, Task, Crew, Process
    HAS_CREWAI = True
except ImportError:
    HAS_CREWAI = False

def create_research_crew(objective: str):
    """
    Creates a hierarchical multi-agent team using CrewAI.
    Invoked by LangGraph when a complex task requires delegation.
    """
    if not HAS_CREWAI:
        return f"CrewAI is not installed. Failed to delegate: {objective}"
    researcher = Agent(
        role='Senior Research Analyst',
        goal='Uncover deep technical details about the given objective',
        backstory='Expert at digging through documentation and finding obscure technical facts.',
        verbose=True,
        allow_delegation=False
    )

    coder = Agent(
        role='Senior Software Engineer',
        goal='Write robust code based on the researcher findings',
        backstory='Veteran programmer who values clean, maintainable code over quick hacks.',
        verbose=True,
        allow_delegation=False
    )

    research_task = Task(
        description=f'Conduct comprehensive research on: {objective}',
        expected_output='A detailed 3-paragraph summary of technical findings.',
        agent=researcher
    )

    coding_task = Task(
        description='Using the research findings, write a proof of concept implementation.',
        expected_output='A code block containing the proof of concept.',
        agent=coder
    )

    crew = Crew(
        agents=[researcher, coder],
        tasks=[research_task, coding_task],
        process=Process.sequential
    )

    return crew

def run_crew_orchestration(objective: str):
    crew = create_research_crew(objective)
    # result = crew.kickoff()
    # return result
    return f"CrewAI finished delegating tasks for: {objective}"
