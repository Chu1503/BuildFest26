"""Shared locations. Intermediate rasters go to work/floorplans (git-ignored)."""
import os
HERE=os.path.dirname(os.path.abspath(__file__))
REPO=os.path.abspath(os.path.join(HERE,'..','..'))
PLANS=os.path.join(REPO,'building-demo','plans')
WORK=os.path.join(REPO,'work','floorplans')
os.makedirs(WORK,exist_ok=True)
os.chdir(WORK)
